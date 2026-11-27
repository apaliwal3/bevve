import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hookHarness } from './helpers/hook-harness.mjs';
import { elements,loadNativeModule } from './helpers/native-module.mjs';
import { createTranslator } from '../src/localization/translation.ts';
import * as adapters from '../src/features/catalog/catalog-adapters.ts';
import * as contributionStore from '../src/features/contributions/account-contribution-store.ts';
import { userId,barId,at,venue,drink,impression } from './helpers/catalog-fixtures.mjs';

const theme=loadNativeModule('src/constants/theme.ts');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup(saved=true){
  const catalog={mode:'account',status:'ready',userId,venues:[venue()],drinks:[drink],impressions:saved?{[barId]:impression()}:{}};
  let next=100,requests=[],fail=false;
  const stored={crowds:[{id:'10000000-0000-4000-8000-000000000001',bar_id:barId,user_id:userId,level:2,created_at:at}],
    bathrooms:[{id:'10000000-0000-4000-8000-000000000002',bar_id:barId,user_id:userId,cleanliness:4,accessibility:null,wait_time:5,created_at:at,updated_at:at}],prices:[]};
  const store=contributionStore.createAccountContributionStore(userId,{load:async()=>stored,save:async(_user,request)=>{
    requests.push(request);if(fail)throw Error('offline');
    const input=request.input;
    return input.kind==='crowd'?{kind:'crowd',row:{id:request.id,bar_id:barId,user_id:userId,level:input.level,created_at:at}}
      : input.kind==='bathroom'?{kind:'bathroom',row:{...stored.bathrooms[0],cleanliness:input.cleanliness,accessibility:input.accessibility,wait_time:input.wait_time}}
        :{kind:'price',row:{id:request.id,bar_id:barId,drink_id:input.drinkId,price_cents:input.priceCents,currency:'EUR',submitted_by:userId,observed_at:at}};
  }},()=>`10000000-0000-4000-8000-${String(++next).padStart(12,'0')}`,()=>{});
  store.setCatalog(catalog);const stop=store.start();
  let harness=hookHarness();
  function load(){return loadNativeModule('src/features/contributions/account-contribution-panel.tsx',{
    './optional-contribution-card':{OptionalContributionCard:'OptionalContributionCard'},react:harness.react,'@/components/app-icon':{AppIcon:'AppIcon'},'@/components/primary-button':{PrimaryButton:'PrimaryButton'},'@/constants/theme':theme,
    '@/features/catalog/catalog-adapters':adapters,'@/localization/language-provider':{useTranslation:()=>({t:createTranslator('en')})},
    './account-contribution-store':contributionStore,
    './account-contributions-provider':{useAccountContributions:()=>({...store.getSnapshot(),submit:store.submit,retry:store.retry,refresh:store.refresh})},
    './crowd-report-form':{CrowdReportForm:'CrowdReportForm'},'./bathroom-review-form':{BathroomReviewForm:'BathroomReviewForm'},'./drink-price-form':{DrinkPriceForm:'DrinkPriceForm'},
  });}
  let module=load();
  function render(){const tree=harness.render(()=>module.AccountContributionPanel({catalog,barId}));harness.effects();return [...elements(tree)];}
  return{catalog,store,requests,stop,render,setFail(value){fail=value;},
    open(label){assert.ok(render().some(node=>node.props.titleKey===label));},
    remount(){harness.unmount();harness=hookHarness();module=load();},
  };
}

test('connected optional cards prefill server reports/reviews and use the database drink catalog',async()=>{
  const ui=setup();await tick();
  ui.open('Report crowd');ui.open('Rate bathrooms');ui.open('Update drink prices');
  const nodes=ui.render();
  assert.equal(nodes.find(node=>node.type==='CrowdReportForm').props.savedReport.level,2);
  assert.equal(nodes.find(node=>node.type==='BathroomReviewForm').props.savedReview.accessibility,null);
  const prices=nodes.find(node=>node.type==='DrinkPriceForm');assert.equal(prices.props.catalog,ui.catalog.drinks);
  prices.props.onSubmit(drink.id,675);await tick();assert.deepEqual(ui.requests[0].input,{kind:'price',barId,drinkId:drink.id,priceCents:675});
  assert.equal(ui.store.getSnapshot().prices[0].drink_id,drink.id);ui.stop();
});

test('reopening pending forms restores the request payload and retries it once with the same ID',async()=>{
  const ui=setup();await tick();ui.setFail(true);ui.open('Update drink prices');
  await assert.rejects(ui.render().find(node=>node.type==='DrinkPriceForm').props.onSubmit(drink.id,675));await tick();
  const before=ui.requests[0];ui.remount();ui.open('Update drink prices');
  const form=ui.render().find(node=>node.type==='DrinkPriceForm');assert.equal(form.props.initialPrice.drinkId,drink.id);assert.equal(form.props.initialPrice.priceCents,675);assert.equal(form.props.feedback.error,true);
  ui.setFail(false);form.props.feedback.retry();await tick();assert.deepEqual(ui.requests[1],before);assert.equal(ui.store.getSnapshot().prices.length,1);ui.stop();
});

test('optional account forms require a saved impression and never upload guest state',async()=>{
  const ui=setup(false);await tick();const nodes=ui.render();
  assert.ok(nodes.some(node=>node.props.children==='Save your impression to continue to optional contributions.'));
  assert.ok(!nodes.some(node=>node.props.accessibilityLabel==='Report crowd'));assert.equal(ui.requests.length,0);ui.stop();
});
