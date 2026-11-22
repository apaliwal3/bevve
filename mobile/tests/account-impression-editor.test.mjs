import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hookHarness } from './helpers/hook-harness.mjs';
import { elements, loadNativeModule } from './helpers/native-module.mjs';
import { createTranslator } from '../src/localization/translation.ts';
import { userId,barId,venue,impression } from './helpers/catalog-fixtures.mjs';

const theme=loadNativeModule('src/constants/theme.ts');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup(save,initial) {
  const harness=hookHarness();let closed=0;
  const catalog={mode:'account',userId,venues:[venue()],impressions:initial?{[barId]:impression(initial)}:{},saving:{},
    async save(id,value){catalog.saving[id]=true;try{await save(id,value);catalog.impressions[id]=impression(value);}finally{catalog.saving[id]=false;}}};
  const module=loadNativeModule('src/features/catalog/account-impression-editor.tsx',{
    react:harness.react,'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:20,bottom:20})},
    '@/components/primary-button':{PrimaryButton:'PrimaryButton'},'@/constants/theme':theme,
    '@/features/impressions/impression-selector':{ImpressionSelector:'ImpressionSelector'},
    '@/localization/language-provider':{useTranslation:()=>({t:createTranslator('en')})},
  });
  function render(){const tree=harness.render(()=>module.AccountImpressionEditor({catalog,barId,name:'Database venue',onClose:()=>closed++}));harness.effects();return [...elements(tree)];}
  return {render,harness,get closed(){return closed;}};
}

test('the editor requires selection and saves only once on rapid taps',async()=>{
  let resolve;let calls=0;
  const ui=setup(async(id,value)=>{assert.equal(id,barId);assert.equal(value,'liked');calls++;await new Promise(done=>{resolve=done;});});
  assert.equal(ui.render().find(node=>node.props.label==='Save impression').props.disabled,true);
  ui.render().find(node=>node.type==='ImpressionSelector').props.onChange('liked');
  const save=ui.render().find(node=>node.props.label==='Save impression');save.props.onPress();save.props.onPress();
  assert.equal(calls,1);assert.equal(ui.render().find(node=>node.type==='ImpressionSelector').props.disabled,true);
  resolve();await tick();
  assert.ok(ui.render().some(node=>node.props.children==='Saved to your account'));
  assert.equal(ui.render().find(node=>node.props.label==='Save impression').props.disabled,true);
  ui.harness.unmount();
});

test('failed saves keep the draft available for retry and never display success',async()=>{
  const ui=setup(async()=>{throw new Error('offline');});
  ui.render().find(node=>node.type==='ImpressionSelector').props.onChange('disliked');
  ui.render().find(node=>node.props.label==='Save impression').props.onPress();await tick();
  const nodes=ui.render();
  assert.equal(nodes.find(node=>node.type==='ImpressionSelector').props.value,'disliked');
  assert.ok(nodes.some(node=>node.props.accessibilityRole==='alert'));
  assert.ok(!nodes.some(node=>node.props.children==='Saved to your account'));
  assert.equal(nodes.find(node=>node.props.label==='Save impression').props.disabled,false);
  ui.harness.unmount();
});

test('an existing impression is preselected and cancelling an edit performs no write',()=>{
  let writes=0;const ui=setup(async()=>writes++,'fine');
  assert.equal(ui.render().find(node=>node.type==='ImpressionSelector').props.value,'fine');
  ui.render().find(node=>node.type==='ImpressionSelector').props.onChange('liked');
  ui.render().find(node=>node.props.label==='Cancel').props.onPress();
  assert.equal(writes,0);assert.equal(ui.closed,1);ui.harness.unmount();
});
