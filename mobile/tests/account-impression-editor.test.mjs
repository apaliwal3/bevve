import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hookHarness } from './helpers/hook-harness.mjs';
import { elements, loadNativeModule, nativeStub } from './helpers/native-module.mjs';
import { createTranslator } from '../src/localization/translation.ts';
import { userId,barId,venue,impression } from './helpers/catalog-fixtures.mjs';

const theme=loadNativeModule('src/constants/theme.ts');
const styles=loadNativeModule('src/features/ratings/rating-overlay-styles.ts',{'@/constants/theme':theme});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup(save,initial) {
  const harness=hookHarness();let closed=0;
  const timers=new Map();let timerId=0;
  const comparisons={status:'ready',batches:{},begin(id){comparisons.batches[id]={id:'batch',opponents:[catalog.venues[1].id],round:0};}};
  const catalog={mode:'account',userId,venues:[venue()],impressions:initial?{[barId]:impression(initial)}:{},saving:{},
    async save(id,value){catalog.saving[id]=true;try{await save(id,value);catalog.impressions[id]=impression(value);}finally{catalog.saving[id]=false;}}};
  class Value { stopAnimation(){} interpolate(){return 0;} }
  const module=loadNativeModule('src/features/catalog/account-impression-editor.tsx',{
    react:harness.react,
    'react-native':{...nativeStub,Modal:'Modal',ScrollView:'ScrollView',useWindowDimensions:()=>({height:800}),Animated:{Value,View:'AnimatedView'}},
    'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:20,bottom:20,left:0,right:0})},
    '@/components/primary-button':{PrimaryButton:'PrimaryButton'},'@/constants/theme':theme,'@/components/app-icon':{AppIcon:'AppIcon'},
    '@/features/impressions/impression-selector':{ImpressionSelector:'ImpressionSelector',impressionLabels:{liked:'I liked it',fine:'It was fine',disliked:"I didn't like it"}},
    '@/features/comparisons/account-comparison-panel':{AccountComparisonPanel:'AccountComparisonPanel'},
    '@/features/comparisons/account-comparisons-provider':{useAccountComparisons:()=>comparisons},
    '@/features/contributions/account-safety-panel':{AccountIncidentPanel:'AccountIncidentPanel'},
    '@/features/contributions/contribution-batch':{ContributionBatch:'ContributionBatch',SaveContributionsButton:'SaveContributionsButton'},
    '@/features/ratings/rating-overlay-styles':styles,
    '@/localization/language-provider':{useTranslation:()=>({t:createTranslator('en')})},
  },{setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id)});
  function render(){const tree=harness.render(()=>module.AccountImpressionEditor({catalog,barId,name:'Database venue',onClose:()=>closed++,children:'Optional forms'}));harness.effects();return [...elements(tree)];}
  return {render,harness,comparisons,catalog,get closed(){return closed;},flush(){for(const [id,fn]of [...timers]){timers.delete(id);fn();}return render();}};
}

test('selection continues through the demo stages and rapid taps save the impression once',async()=>{
  let resolve;let calls=0;
  const ui=setup(async(id,value)=>{assert.equal(id,barId);assert.equal(value,'liked');calls++;await new Promise(done=>{resolve=done;});});
  assert.equal(ui.render().find(node=>node.props.label==='Save impression and continue').props.disabled,true);
  assert.ok(!ui.render().some(node=>node.props.children==='Optional forms'));
  ui.render().find(node=>node.type==='ImpressionSelector').props.onChange('liked');
  const save=ui.render().find(node=>node.props.label==='Save impression and continue');save.props.onPress();save.props.onPress();
  assert.equal(calls,1);assert.equal(ui.render().find(node=>node.type==='ImpressionSelector').props.disabled,true);
  resolve();await tick();ui.render();
  const nodes=ui.flush();
  assert.ok(nodes.some(node=>node.props.children==='Saved to your account'));
  assert.ok(nodes.some(node=>Array.isArray(node.props.children) && node.props.children.includes('Optional forms')));
  assert.equal(nodes.filter(node=>node.type==='SaveContributionsButton').length,1);
  assert.ok(!nodes.some(node=>node.props.label==='Save impression'));
  ui.harness.unmount();
});

test('failed impressions retain their draft for retry and do not advance',async()=>{
  const ui=setup(async()=>{throw new Error('offline');});
  ui.render().find(node=>node.type==='ImpressionSelector').props.onChange('disliked');
  ui.render().find(node=>node.props.label==='Save impression and continue').props.onPress();await tick();
  const nodes=ui.render();
  assert.equal(nodes.find(node=>node.type==='ImpressionSelector').props.value,'disliked');
  assert.ok(nodes.some(node=>node.props.accessibilityRole==='alert'));
  assert.ok(!nodes.some(node=>Array.isArray(node.props.children) && node.props.children.includes('Optional forms')));
  assert.equal(nodes.find(node=>node.props.label==='Save impression and continue').props.disabled,false);
  ui.harness.unmount();
});

test('saved impressions continue directly to contributions without resaving',()=>{
  let writes=0;const ui=setup(async()=>writes++,'fine');
  ui.render().find(node=>node.props.label==='Continue to contributions').props.onPress();
  assert.ok(ui.render().some(node=>node.type==='SaveContributionsButton'));assert.equal(writes,0);
  ui.harness.unmount();
});

test('closing discards an unsaved impression and dismissal is blocked during the final save',()=>{
  let writes=0;const ui=setup(async()=>writes++,'fine');
  ui.render().find(node=>node.type==='ImpressionSelector').props.onChange('liked');
  ui.render().find(node=>node.props.accessibilityLabel==='Close bar actions').props.onPress();
  assert.equal(writes,0);assert.equal(ui.closed,1);ui.harness.unmount();
  const saving=setup(async()=>{},'liked');saving.render().find(node=>node.props.label==='Continue to contributions').props.onPress();
  const batch=saving.render().find(node=>node.type==='ContributionBatch');batch.props.onSavingChange(true);
  saving.render().find(node=>node.type==='Modal').props.onRequestClose();assert.equal(saving.closed,0);
  batch.props.onSavingChange(false);saving.render().find(node=>node.type==='SaveContributionsButton').props.onComplete();assert.equal(saving.closed,1);
  saving.harness.unmount();
});


test('a new impression starts comparisons, then advances to details when the batch finishes',async()=>{
  const ui=setup(async()=>{});
  const otherId='10000000-0000-4000-8000-000000000099';
  ui.catalog.venues.push({...venue(),id:otherId});ui.catalog.impressions[otherId]={...impression(),bar_id:otherId};
  ui.render().find(node=>node.type==='ImpressionSelector').props.onChange('liked');
  ui.render().find(node=>node.props.label==='Save impression and continue').props.onPress();await tick();ui.render();ui.flush();
  assert.ok(ui.render().some(node=>node.type==='AccountComparisonPanel'));
  assert.equal(ui.comparisons.batches[barId].round,0);
  ui.comparisons.batches[barId]={...ui.comparisons.batches[barId],round:1};ui.render();ui.flush();
  assert.ok(ui.render().some(node=>node.type==='SaveContributionsButton'));ui.harness.unmount();
});


test('a private incident report still opens without saving an impression',()=>{
  let writes=0;const ui=setup(async()=>{writes++;});
  ui.render().find(node=>node.props.label==='Optional private incident report').props.onPress();
  const nodes=ui.render();assert.ok(nodes.some(node=>node.type==='AccountIncidentPanel'));
  assert.ok(nodes.some(node=>node.type==='SaveContributionsButton'));assert.equal(writes,0);ui.harness.unmount();
});
