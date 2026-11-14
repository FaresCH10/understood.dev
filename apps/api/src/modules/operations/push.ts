import { Schema, model } from 'mongoose';
import { Router } from 'express';
import * as webpush from 'web-push';
import { z } from 'zod';
import { config } from '../../config.js';
import { AppError } from '../../errors.js';
import { asyncHandler, parseBody, sendData } from '../../http.js';
import { requireStaff, requireWorkerPortal } from '../access/control.js';
import { Organization, User, Worker } from '../../models.js';
import { Notification } from './models.js';
import { logger } from '../../logger.js';

const schema=new Schema({orgId:{type:Schema.Types.ObjectId,required:true},actorId:{type:String,required:true},worker:{type:Boolean,required:true},
  endpoint:{type:String,required:true,unique:true},keys:{p256dh:String,auth:String},failures:{type:Number,default:0},
},{timestamps:true,collection:'push_subscriptions'});
schema.index({orgId:1,actorId:1});
export const PushSubscription=model('PushSubscription',schema);
const enabled=()=>Boolean(config.VAPID_PUBLIC_KEY&&config.VAPID_PRIVATE_KEY&&config.VAPID_SUBJECT);
export function trustedPushEndpoint(value:string){
  try{const url=new URL(value);const hostname=url.hostname.toLowerCase();return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&
    (hostname==='fcm.googleapis.com'||hostname.endsWith('.push.services.mozilla.com')||hostname.endsWith('.push.apple.com')||hostname.endsWith('.notify.windows.com'));}catch{return false;}
}
const subscriptionSchema=z.object({subscription:z.object({endpoint:z.string().url().max(2048).refine(trustedPushEndpoint,'Unsupported browser push service.'),expirationTime:z.number().nullable().optional(),keys:z.object({p256dh:z.string().regex(/^[A-Za-z0-9_-]+={0,2}$/).max(200),auth:z.string().regex(/^[A-Za-z0-9_-]+={0,2}$/).max(100)})})});
function router(worker:boolean){
  const result=Router();
  const identity=async(req:Parameters<typeof requireStaff>[0])=>{
    if(worker){const ctx=await requireWorkerPortal(req);if(ctx.sharedDevice)throw new AppError('FORBIDDEN');return {orgId:ctx.org._id,actorId:String(ctx.worker._id)};}
    const ctx=await requireStaff(req,['owner','supervisor']);return {orgId:ctx.org._id,actorId:String(ctx.user._id)};
  };
  result.get('/push-key',asyncHandler(async(req,res)=>{await identity(req);sendData(res,{enabled:enabled(),publicKey:enabled()?config.VAPID_PUBLIC_KEY:null});}));
  result.post('/push-subscriptions',asyncHandler(async(req,res)=>{
    const ctx=await identity(req);if(!enabled())throw new AppError('SERVICE_UNAVAILABLE');
    const {subscription}=parseBody(subscriptionSchema,req);
    // One browser subscription belongs to the identity that most recently opted in.
    await PushSubscription.findOneAndUpdate({endpoint:subscription.endpoint},{$set:{...ctx,worker,endpoint:subscription.endpoint,keys:subscription.keys,failures:0}},{upsert:true});sendData(res,{subscribed:true},undefined,201);
  }));
  result.delete('/push-subscriptions',asyncHandler(async(req,res)=>{const ctx=await identity(req);const {endpoint}=parseBody(z.object({endpoint:z.string().max(2048)}),req);await PushSubscription.deleteOne({...ctx,endpoint});sendData(res,{unsubscribed:true});}));
  return result;
}
export const staffPushRouter=router(false);
export const portalPushRouter=router(true);
let running=false;
export async function dispatchPush(){
  if(!enabled()||running)return;running=true;
  try{
    webpush.setVapidDetails(config.VAPID_SUBJECT!,config.VAPID_PUBLIC_KEY!,config.VAPID_PRIVATE_KEY!);
    const notifications=await Notification.find({pushedAt:{$exists:false},createdAt:{$gte:new Date(Date.now()-7*86400000)}}).sort({createdAt:1}).limit(25);
    for(const notification of notifications){
      const org=await Organization.findById(notification.orgId);if(!org||org.accessStatus!=='active'||org.deletingAt||(org.expiresAt&&org.expiresAt<=new Date())){notification.pushedAt=new Date();await notification.save();continue;}
      let actors:string[]=[];
      if(notification.workerId){if(await Worker.exists({_id:notification.workerId,orgId:org._id,accessDisabled:{$ne:true},archivedAt:null}))actors=[String(notification.workerId)];}
      else actors=(await User.find({orgId:org._id,disabledAt:null,role:{$in:['owner','supervisor']},$or:[{role:'owner'},{siteIds:notification.siteId}]}).select('_id').lean()).map(u=>String(u._id));
      const subscriptions=await PushSubscription.find({orgId:org._id,actorId:{$in:actors},worker:Boolean(notification.workerId)});
      let transientFailure=false;
      for(const subscription of subscriptions){
        if(!trustedPushEndpoint(subscription.endpoint))continue;
        try{await webpush.sendNotification({endpoint:subscription.endpoint,keys:{p256dh:subscription.keys?.p256dh??'',auth:subscription.keys?.auth??''}},JSON.stringify({title:'Understood',body:'New activity is available. Sign in to view it.',url:subscription.worker?'/i/':'/'}),{TTL:3600,timeout:5000});}
        catch(error){const status=(error as {statusCode?:number}).statusCode;if(status===404||status===410)await subscription.deleteOne();else{transientFailure=true;await PushSubscription.updateOne({_id:subscription._id},{$inc:{failures:1}});}}
      }
      if(!transientFailure){notification.pushedAt=new Date();await notification.save();}
    }
  }catch(error){logger.warn({err:error instanceof Error?error.message:'push dispatch failed'},'push dispatch failed');}finally{running=false;}
}
