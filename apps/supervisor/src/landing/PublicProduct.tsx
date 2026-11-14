import {BrandLogo} from './BrandLogo';
import {useEffect,useState} from 'react';
import {ArrowLeft} from 'lucide-react';
import {PUBLIC_SECTIONS,isHelpView} from './public-navigation';
import {landingCopy,type LandingLocale} from './landing-content';
import {LandingPage} from './LandingPage';
import {LandingDemo} from './LandingDemo';
import {LandingPlans} from './LandingPlans';
import {PublicHeader} from './PublicHeader';
import {ContactPage} from './PublicContact';
import './public-product.css';
import './landing-page.css';
import './landing-mobile-compact.css';

const localeKey='understood:public-language';
function savedLocale():LandingLocale{try{return sessionStorage.getItem(localeKey)==='ar'?'ar':'en';}catch{return 'en';}}
export default function PublicProduct({view,registrationAvailable=false}:{view:string;registrationAvailable?:boolean}){
  const [locale,setLocale]=useState<LandingLocale>(savedLocale),t=landingCopy[locale];
  useEffect(()=>{document.documentElement.lang=locale;document.documentElement.dir=locale==='ar'?'rtl':'ltr';},[locale]);
  useEffect(()=>{if(view==='pricing'||view==='pilot'||view==='contact'||view==='walkthrough'||isHelpView(view))window.scrollTo({top:0,left:0,behavior:'instant'});},[view]);
  function changeLocale(value:LandingLocale){setLocale(value);try{sessionStorage.setItem(localeKey,value);localStorage.setItem('understood.staff.locale',value);}catch{}}
  return <div className="public-product marketing-site" id="home" lang={locale} dir={locale==='ar'?'rtl':'ltr'}>
    <a className="public-skip" href="#public-main" onClick={event=>{event.preventDefault();document.getElementById('public-main')?.focus();}}>{t.skip}</a>
    <PublicHeader locale={locale} onLocale={changeLocale} view={view} registrationAvailable={registrationAvailable}/>
    <main id="public-main" tabIndex={-1}>
      {view==='pricing'?<div className="landing-full-pricing"><div className="landing-container"><a className="landing-text-link" href="#plans"><ArrowLeft size={17}/>{locale==='ar'?'العودة إلى الخطط':'Back to plans'}</a><h1>{locale==='ar'?'الأسعار ومقارنة الخطط':'Pricing and plan comparison'}</h1></div><LandingPlans locale={locale} registrationAvailable={registrationAvailable}/></div>:isHelpView(view)?<ContactPage locale={locale}/>:view==='contact'?<ContactPage locale={locale}/>:view==='pilot'?<div className="public-legacy-page" lang={locale} dir={locale==='ar'?'rtl':'ltr'}><ContactPage locale={locale}/></div>:view==='walkthrough'?<div className="landing-standalone-demo landing-container"><a className="landing-text-link" href="#home"><ArrowLeft size={17} aria-hidden="true"/>Understood</a><header className="landing-section-heading"><h1>{t.workflowTitle}</h1><p>{t.workflowBody}</p></header><LandingDemo locale={locale}/></div>:<LandingPage key={locale} view={view} locale={locale} registrationAvailable={registrationAvailable}/>}
    </main>
    <footer className="landing-footer"><div className="landing-container"><div className="landing-footer-top"><div><a className="landing-brand" href="#home"><BrandLogo/></a><p>{t.footer}</p></div><nav aria-label={locale==='ar'?'روابط التذييل':'Footer navigation'}>{PUBLIC_SECTIONS.map(section=><a key={section.id} href={`#${section.id}`}>{section[locale]}</a>)}</nav></div><div className="landing-footer-bottom"><p>{t.footerNote}</p><div><a href="/i/">{locale==='ar'?'دخول العامل':'Worker sign in'}</a><a href="#contact">{locale==='ar'?'تواصل معنا':'Contact us'}</a><a href="/signin?register=1">{t.contact}</a><a href="/signin">{t.signIn}</a></div></div></div></footer>
  </div>;
}
