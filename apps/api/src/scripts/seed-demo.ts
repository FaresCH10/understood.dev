import { connectMongo, disconnectMongo } from '../db.js';
import { config, isProduction } from '../config.js';
import { Crew, Organization, User, Worker } from '../models.js';
import { Site } from '../modules/access/models.js';
import { hashPassword } from '../auth/passwords.js';
import { Operation } from '../modules/operations/models.js';
import { prepareVariant, publishOperation } from '../modules/operations/service.js';
import type { Language } from '@understood/shared';

async function main(){
  if(isProduction||!/^mongodb:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(config.MONGODB_URI))throw new Error('Demo seeding is restricted to a local development database.');
  await connectMongo();
  const password=process.env.DEMO_PASSWORD??'Understood-demo-2026!';
  const passwordHash=await hashPassword(password);
  const org=await Organization.findOneAndUpdate({companyId:'understood-demo'},{$setOnInsert:{name:'Understood demo',companyId:'understood-demo',timezone:'Asia/Dubai',locale:'en',plan:'pilot',accessStatus:'active',subscription:'pilot',activatedAt:new Date(),expiresAt:new Date(Date.now()+30*86400000)}},{upsert:true,new:true});
  const site=await Site.findOneAndUpdate({orgId:org._id,name:'Demo warehouse'},{$setOnInsert:{timezone:'Asia/Dubai'}},{upsert:true,new:true});
  const owner=await User.findOneAndUpdate({email:'owner@demo.understood.local'},{$set:{orgId:org._id,name:'Demo owner',role:'owner',siteIds:[site._id],emailVerifiedAt:new Date(),passwordHash}},{upsert:true,new:true});
  const crew=await Crew.findOneAndUpdate({orgId:org._id,name:'Morning crew'},{$set:{siteId:site._id}},{upsert:true,new:true});
  const entries:Array<{name:string;workerId:string;language:Language}>=[{name:'Asha',workerId:'W001',language:'en'},{name:'Omar',workerId:'W002',language:'ar'},{name:'Priya',workerId:'W003',language:'hi'}];
  for(const entry of entries){await Worker.findOneAndUpdate({orgId:org._id,workerId:entry.workerId},{$set:{...entry,normalizedName:entry.name.toLowerCase(),siteId:site._id,crewId:crew._id,passwordHash,languageSelected:true,accessDisabled:false,archivedAt:null}},{upsert:true,new:true});}
  if(!await Operation.exists({orgId:org._id})){
    const title='Move the blue boxes';const text='Move the blue boxes to bay 4 before lunch.';
    const question={text:'Where do the blue boxes go?',options:['Bay 4','Bay 1','Bay 2'],correctIndex:0};
    const variants=[];
    for(const language of entries.map(e=>e.language)){variants.push({...await prepareVariant({orgId:String(org._id),text,sourceLanguage:'en',language,deliveryMode:'text',questionEnabled:true,question}),reviewed:true});}
    const instruction=await Operation.create({orgId:org._id,siteId:site._id,createdBy:owner._id,title,text,sourceLanguage:'en',deliveryMode:'text',questionEnabled:true,question,crewIds:[crew._id],workerIds:[],everyone:false,status:'ready',variants});
    await publishOperation(String(instruction._id),String(owner._id));
  }
  console.log(`Demo ready. ${config.APP_URL}/signin\nStaff: owner@demo.understood.local\nPassword: ${password}\nWorker link: ${config.APP_URL}/i/\nCompany: understood-demo\nWorkers: W001 (English), W002 (Arabic), W003 (Hindi)\nWorker password: ${password}\nDemo translations are visibly labeled untranslated examples.`);
  await disconnectMongo();
}
main().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exit(1);});
