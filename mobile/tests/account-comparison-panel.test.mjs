import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAccountComparisonStore } from '../src/features/comparisons/account-comparison-store.ts';
import * as adapters from '../src/features/catalog/catalog-adapters.ts';
import { createTranslator } from '../src/localization/translation.ts';
import { elements, loadNativeModule } from './helpers/native-module.mjs';
import { userId, barId, at, venue, impression } from './helpers/catalog-fixtures.mjs';

const theme=loadNativeModule('src/constants/theme.ts');
const otherId='10000000-0000-4000-8000-000000000002';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup(repository, saved = true) {
  let next=100;
  const catalog={status:'ready',userId,venues:[venue(),venue({id:otherId,name:'Other database venue'})],
    impressions:saved?{[barId]:impression(),[otherId]:impression('fine',{bar_id:otherId})}:{},saving:{}};
  const store=createAccountComparisonStore(userId,repository,()=>`10000000-0000-4000-8000-${String(++next).padStart(12,'0')}`);
  store.setCatalog(catalog);const stop=store.start();
  const module=loadNativeModule('src/features/comparisons/account-comparison-panel.tsx',{
    '@/components/primary-button':{PrimaryButton:'PrimaryButton'},'@/constants/theme':theme,
    '@/features/catalog/catalog-adapters':adapters,
    '@/localization/language-provider':{useTranslation:()=>({t:createTranslator('en')})},
    './account-comparisons-provider':{useAccountComparisons:()=>({...store.getSnapshot(),begin:store.begin,choose:store.choose,skip:store.skip,refresh:store.refresh})},
    './preference-venue-card':{PreferenceVenueCard:'PreferenceVenueCard'},
  });
  function render(){return [...elements(module.AccountComparisonPanel({catalog,barId}))];}
  return {catalog,store,stop,render,feedback:()=>[...elements(module.AccountComparisonFeedback())],
    press(label){const button=render().find(node=>node.props.label===label);assert.ok(button,`Missing ${label}`);button.props.onPress();}};
}

test('account comparison UI requires saved experience, starts explicitly, labels samples and resumes without a new batch',async()=>{
  let calls=0;
  const ui=setup({load:async()=>[],save:async()=>{calls++;}},false);await tick();
  assert.ok(ui.render().some(node=>node.props.children==='Save your impression before comparing this venue.'));
  assert.ok(!ui.render().some(node=>node.type==='PreferenceVenueCard'));
  ui.catalog.impressions={[barId]:impression(),[otherId]:impression('fine',{bar_id:otherId})};ui.store.setCatalog(ui.catalog);
  ui.press('Start comparisons');const batch=ui.store.getSnapshot().batches[barId];
  const nodes=ui.render(),cards=nodes.filter(node=>node.type==='PreferenceVenueCard');
  assert.equal(cards.length,2);assert.equal(cards[1].props.venue.name,'Other database venue');assert.equal(cards[1].props.venue.image,null);
  assert.equal(nodes.filter(node=>node.props.children==='Sample venue').length,2);
  ui.render();assert.equal(ui.store.getSnapshot().batches[barId],batch);assert.equal(calls,0);
  ui.press('Skip this comparison');assert.equal(ui.store.getSnapshot().history.length,0);
  assert.ok(ui.render().some(node=>node.props.label==='Compare this bar again'));ui.stop();
});

test('uncertain saves retain the chosen card, disable skipping, and retry the original choice',async()=>{
  let attempts=[],fail=true;
  const ui=setup({load:async()=>[],save:async(_user,request)=>{attempts.push(request);if(fail)throw Error('offline');return {id:request.id,user_id:userId,winner_bar_id:request.winnerId,loser_bar_id:request.loserId,created_at:at};}});await tick();
  ui.press('Start comparisons');ui.render().find(node=>node.type==='PreferenceVenueCard').props.onChoose();await tick();
  const nodes=ui.render(),cards=nodes.filter(node=>node.type==='PreferenceVenueCard');
  assert.equal(cards[0].props.selected,true);assert.ok(cards.every(node=>node.props.disabled));
  assert.equal(nodes.find(node=>node.props.label==='Skip remaining comparisons').props.disabled,true);
  assert.ok(nodes.some(node=>node.props.accessibilityRole==='alert'));
  fail=false;ui.press('Retry choice');await tick();assert.deepEqual(attempts[0],attempts[1]);
  assert.equal(ui.store.getSnapshot().history.length,1);assert.ok(ui.render().some(node=>node.props.children==='Comparison batch finished.'));ui.stop();
});

test('history load failures show retry controls and never present an empty successful ranking',async()=>{
  let offline=true;
  const ui=setup({load:async()=>{if(offline)throw Error('offline');return [];},save:async()=>{}});await tick();
  assert.ok(ui.feedback().some(node=>node.props.children==='Your comparisons could not be loaded.'));
  assert.ok(!ui.render().some(node=>node.props.label==='Start comparisons'));
  offline=false;ui.feedback().find(node=>node.props.label==='Retry comparisons').props.onPress();await tick();
  assert.equal(ui.feedback().length,0);assert.ok(ui.render().some(node=>node.props.label==='Start comparisons'));ui.stop();
});
