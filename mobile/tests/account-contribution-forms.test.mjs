import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hookHarness } from './helpers/hook-harness.mjs';
import { elements,loadNativeModule } from './helpers/native-module.mjs';
import { createTranslator } from '../src/localization/translation.ts';
import * as formatting from '../src/localization/formatting.ts';
import * as drafts from '../src/features/contributions/contribution-drafts.ts';
import * as extraDrafts from '../src/features/contributions/extra-form-drafts.ts';
import * as extras from '../src/features/contributions/venue-extras-state.ts';
import * as copy from '../src/localization/venue-copy.ts';
import * as fixtureCatalog from '../src/fixtures/contribution-catalog.ts';
import { createContributionBatch } from '../src/features/contributions/contribution-batch-store.ts';
import { drink } from './helpers/catalog-fixtures.mjs';

const theme=loadNativeModule('src/constants/theme.ts');
const formStyles=loadNativeModule('src/features/contributions/inline-form-styles.ts',{'@/constants/theme':theme});
const translation={t:createTranslator('en'),format:formatting.createLocaleFormatters('en')};
function setup(kind,extraProps={},batchStore=null){
  const harness=hookHarness();let closed=0;
  const names={crowd:['crowd-report-form','CrowdReportForm'],bathroom:['bathroom-review-form','BathroomReviewForm'],price:['drink-price-form','DrinkPriceForm'],language:['spoken-languages-form','SpokenLanguagesForm'],safety:['safety-information-form','SafetyInformationForm']};
  const [file,name]=names[kind];
  const batching=loadNativeModule('src/features/contributions/contribution-batch.tsx', {
    react:{...harness.react,createContext:()=>({Provider:'Provider'}),useContext:()=>batchStore?{store:batchStore,saving:batchStore.getSnapshot().saving}:null},
    '@/components/primary-button':{PrimaryButton:'PrimaryButton'},
    '@/localization/language-provider':{useTranslation:()=>translation},'./inline-form-styles':formStyles,
    './contribution-batch-store':{createContributionBatch},
  });
  const module=loadNativeModule(`src/features/contributions/${file}.tsx`,{
    './contribution-batch':batching,
    react:harness.react,'@/components/primary-button':{PrimaryButton:'PrimaryButton'},'@/constants/theme':theme,
    '@/features/ratings/star-selector':{StarSelector:'StarSelector'},'@/fixtures/contribution-catalog':fixtureCatalog,
    '@/localization/language-provider':{useTranslation:()=>translation},'@/localization/venue-copy':copy,
    './contribution-drafts':drafts,'./extra-form-drafts':extraDrafts,'./venue-extras-state':extras,'./inline-form-styles':formStyles,
  });
  const props={demoNotes:[],languages:[],pending:[],savedReport:null,savedReview:null,prices:[],catalog:[drink],onCancel:()=>closed++,onSubmit:()=>{},...extraProps};
  function render(){const tree=harness.render(()=>module[name](props));harness.effects();return [...elements(tree)];}
  return{props,render,harness,get closed(){return closed;},button(label){return render().find(node=>node.props.label===label);}};
}
const feedback=()=>({pending:false,saving:false,error:false,saved:false,retry:()=>{}});

test('account private forms use controlled drafts, preserve details on close, and show success only after confirmation',()=>{
  const state=feedback();let submitted,retries=0;
  state.retry=()=>retries++;
  const ui=setup('safety',{feedback:state,draft:{category:'Other',description:'Private synthetic details',date:'2020-01-02'},
    onSubmit:value=>{submitted=value;state.pending=true;state.saving=true;}});
  ui.props.onDraftAction=action=>{ui.props.draft=extraDrafts.incidentDraftReducer(ui.props.draft,action);};
  ui.render().find(node=>node.props.accessibilityLabel==='Private incident description').props.onChangeText('Changed private details');
  ui.button('Close').props.onPress();assert.equal(ui.props.draft.description,'Changed private details');assert.equal(ui.closed,1);
  ui.button('Submit report').props.onPress();assert.equal(submitted.description,'Changed private details');
  assert.ok(ui.render().filter(node=>node.type==='TextInput').every(node=>node.props.editable===false));
  assert.ok(!ui.render().some(node=>node.props.children==='Saved in demo only — pending moderation'));
  assert.ok(!ui.render().some(node=>node.props.children==='Private report saved to your account. Check its review status in Profile.'));
  state.saving=false;state.error=true;assert.ok(ui.render().some(node=>node.props.accessibilityRole==='alert'));
  ui.button('Retry save').props.onPress();assert.equal(retries,1);
  state.pending=false;state.error=false;state.saved=true;ui.props.draft={...extraDrafts.emptyIncidentDraft};
  assert.ok(ui.render().some(node=>node.props.children==='Private report saved to your account. Check its review status in Profile.'));
  assert.ok(!ui.render().some(node=>node.props.children==='DEMO DATA'));ui.harness.unmount();
});

test('guest safety submissions remain synchronous, session-only and reset their local draft',()=>{
  let submitted;
  const ui=setup('safety',{onSubmit:value=>{submitted=value;}});
  ui.render().find(node=>node.props.accessibilityRole==='radio').props.onPress();
  ui.render().find(node=>node.props.accessibilityLabel==='Private incident description').props.onChangeText('Guest synthetic details');
  ui.button('Submit report').props.onPress();assert.equal(submitted.description,'Guest synthetic details');
  assert.equal(ui.render().find(node=>node.props.accessibilityLabel==='Private incident description').props.value,'');
  assert.ok(ui.render().some(node=>node.props.children==='Saved in demo only — pending moderation'));ui.harness.unmount();
});

test('account language drafts retain their selection until confirmation and offer retry without a false demo success',()=>{
  const state=feedback();let code,retries=0;
  state.retry=()=>retries++;
  const ui=setup('language',{feedback:state,onSubmit:value=>{code=value;state.pending=true;state.error=true;}});
  ui.render().filter(node=>node.props.accessibilityRole==='radio')[1].props.onPress();
  ui.button('Suggest language').props.onPress();assert.equal(code,'it');
  assert.ok(ui.render().filter(node=>node.props.accessibilityRole==='radio').every(node=>node.props.disabled));
  assert.ok(ui.render().some(node=>node.props.accessibilityRole==='radio'&&node.props.accessibilityState.checked));
  assert.ok(!ui.render().some(node=>typeof node.props.children==='string'&&node.props.children.includes('saved')));
  ui.button('Retry save').props.onPress();assert.equal(retries,1);
  state.pending=false;state.error=false;state.saved=true;ui.props.pending=[{id:'saved',language_code:'it'}];
  assert.ok(ui.render().some(node=>node.props.children==='Language suggestion saved to your account. Check its review status in Profile.'));
  assert.ok(!ui.render().some(node=>node.props.children==='Currently associated · Demo data'));ui.harness.unmount();
});

test('reopened uncertain language forms restore the request and show approved and pending languages separately',()=>{
  const ui=setup('language',{languages:[{code:'en',name:'English'}],pending:[{id:'pending',language_code:'fr'}],initialCode:'it',feedback:{...feedback(),pending:true,error:true}});
  const radios=ui.render().filter(node=>node.props.accessibilityRole==='radio');assert.equal(radios.length,6);
  assert.equal(radios.filter(node=>node.props.accessibilityState.checked).length,1);
  assert.equal(ui.button('Retry save').props.disabled,false);assert.equal(ui.button('Cancel').props.disabled,true);ui.harness.unmount();
});

test('account crowd reports show success only after server confirmation, disable pending edits and expose retry',()=>{
  let calls=0,retries=0;
  const state=feedback();state.retry=()=>retries++;
  const ui=setup('crowd',{feedback:state,onSubmit:()=>{calls++;state.pending=true;state.saving=true;}});
  ui.render().find(node=>node.props.accessibilityLabel==='3 Moderate').props.onPress();
  ui.button('Submit crowd').props.onPress();assert.equal(calls,1);
  let nodes=ui.render();assert.ok(!nodes.some(node=>node.props.children==='Crowd report saved to your account.'));
  assert.equal(ui.button('Retry save').props.disabled,true);assert.ok(nodes.filter(node=>node.props.accessibilityRole==='radio').every(node=>node.props.disabled));
  state.saving=false;state.error=true;assert.ok(ui.render().some(node=>node.props.accessibilityRole==='alert'));
  ui.button('Retry save').props.onPress();assert.equal(retries,1);
  state.pending=false;state.error=false;state.saved=true;
  assert.ok(ui.render().some(node=>node.props.children==='Crowd report saved to your account.'));
  ui.harness.unmount();
});

test('bathroom reviews prefill all saved fields, keep null unknowns unselected, and cancel without a write',()=>{
  let writes=0;
  const ui=setup('bathroom',{savedReview:{cleanliness:4,accessibility:null,wait_time:5},feedback:feedback(),onSubmit:()=>writes++});
  const stars=ui.render().filter(node=>node.type==='StarSelector');
  assert.deepEqual(stars.map(node=>node.props.value),[4,null,5]);assert.equal(ui.button('Submit ratings').props.disabled,true);
  stars[1].props.onChange(3);assert.equal(ui.button('Submit ratings').props.disabled,false);
  ui.button('Cancel').props.onPress();assert.equal(writes,0);assert.equal(ui.closed,1);
  assert.deepEqual(ui.render().filter(node=>node.type==='StarSelector').map(node=>node.props.value),[4,null,5]);ui.harness.unmount();
});

test('bathroom failures keep draft scores, disable uncertain edits and show no false success',()=>{
  const state=feedback();let submitted;
  const ui=setup('bathroom',{savedReview:{cleanliness:2,accessibility:3,wait_time:4},feedback:state,onSubmit:value=>{submitted=value;state.pending=true;state.error=true;}});
  ui.render().filter(node=>node.type==='StarSelector')[0].props.onChange(5);ui.button('Submit ratings').props.onPress();
  assert.deepEqual({...submitted},{cleanliness:5,accessibility:3,wait_time:4});
  const nodes=ui.render();assert.ok(nodes.filter(node=>node.type==='StarSelector').every(node=>node.props.disabled));
  assert.equal(nodes.find(node=>node.type==='StarSelector').props.value,5);assert.ok(!nodes.some(node=>node.props.children==='Bathroom ratings saved to your account.'));ui.harness.unmount();
});

test('price submission uses database drink IDs and serving sizes with exact comma-decimal cents and current-price prefill',()=>{
  let submitted;
  const larger={...drink,id:'10000000-0000-4000-8000-000000000500',serving_ml:500};
  const ui=setup('price',{catalog:[drink,larger],prices:[{id:drink.id,priceCents:600}],feedback:feedback(),onSubmit:(...args)=>{submitted=args;}});
  let radios=ui.render().filter(node=>node.props.accessibilityRole==='radio');assert.equal(radios.length,2);
  assert.ok(radios[0].props.accessibilityLabel.includes('330'));assert.ok(radios[1].props.accessibilityLabel.includes('500'));
  radios[0].props.onPress();assert.equal(ui.render().find(node=>node.props.accessibilityLabel==='Drink price in euros').props.value,'6.00');
  ui.render().find(node=>node.props.accessibilityLabel==='Drink price in euros').props.onChangeText('6,50');ui.button('Submit price').props.onPress();
  assert.deepEqual(submitted,[drink.id,650]);assert.ok(!ui.render().some(node=>typeof node.props.children==='string'&&node.props.children.includes('saved for this demo session')));
  radios=ui.render().filter(node=>node.props.accessibilityRole==='radio');radios[1].props.onPress();assert.equal(ui.render().find(node=>node.props.accessibilityLabel==='Drink price in euros').props.value,'');ui.harness.unmount();
});

test('failed price saves preserve the original draft, and reopening restores the pending database selection without fictional fallback',()=>{
  const state={...feedback(),pending:true,error:true};
  const ui=setup('price',{catalog:[drink],feedback:state,initialPrice:{drinkId:drink.id,priceCents:675}});
  const nodes=ui.render();assert.equal(nodes.find(node=>node.props.accessibilityRole==='radio').props.accessibilityState.checked,true);
  const input=nodes.find(node=>node.props.accessibilityLabel==='Drink price in euros');assert.equal(input.props.value,'6.75');assert.equal(input.props.editable,false);assert.equal(ui.button('Retry save').props.disabled,false);
  assert.ok(!nodes.some(node=>typeof node.props.children==='string'&&node.props.children.includes('saved to your account.')));ui.harness.unmount();
});

test('an empty database drink catalog stays empty and cannot submit a fixture price',()=>{
  const ui=setup('price',{catalog:[],feedback:feedback()});assert.equal(ui.render().filter(node=>node.props.accessibilityRole==='radio').length,0);
  assert.equal(ui.button('Submit price').props.disabled,true);assert.ok(ui.render().some(node=>node.props.children==='No drinks are available in the catalog yet.'));ui.harness.unmount();
});

test('guest forms retain synchronous session-only success behavior',()=>{
  let saved;
  const ui=setup('crowd',{onSubmit:value=>saved=value});ui.render().find(node=>node.props.accessibilityLabel==='3 Moderate').props.onPress();ui.button('Submit crowd').props.onPress();
  assert.equal(saved,3);assert.ok(ui.render().some(node=>node.props.children==='Crowd report saved for this session.'));ui.harness.unmount();
});

test('batched sections have no local submit buttons and write only through the final save',async()=>{
  const batch=createContributionBatch();const writes=[];
  const crowd=setup('crowd',{onSubmit:level=>{writes.push(['crowd',level]);}},batch);
  const bathroom=setup('bathroom',{onSubmit:scores=>{writes.push(['bathroom',{...scores}]);}},batch);
  crowd.render().find(node=>node.props.accessibilityLabel==='3 Moderate').props.onPress();crowd.render();
  bathroom.render().filter(node=>node.type==='StarSelector')[0].props.onChange(4);bathroom.render();
  assert.ok(!crowd.render().some(node=>node.type==='PrimaryButton'));
  assert.ok(!bathroom.render().some(node=>node.type==='PrimaryButton'));
  assert.equal(await batch.submit(),false);assert.deepEqual(writes,[]);
  bathroom.render().filter(node=>node.type==='StarSelector')[1].props.onChange(3);bathroom.render();
  bathroom.render().filter(node=>node.type==='StarSelector')[2].props.onChange(5);bathroom.render();
  assert.equal(await batch.submit(),true);
  assert.deepEqual(writes,[['crowd',3],['bathroom',{cleanliness:4,accessibility:3,wait_time:5}]]);
  crowd.harness.unmount();bathroom.harness.unmount();
});

test('a reopened unconfirmed account draft uses the same request retry in a batch',async()=>{
  const batch=createContributionBatch();let retries=0;
  const ui=setup('price',{catalog:[drink],initialPrice:{drinkId:drink.id,priceCents:675},
    feedback:{pending:true,saving:false,error:true,saved:false,retry:async()=>{retries++;}},onSubmit:()=>assert.fail('Must retry the original request')},batch);
  ui.render();assert.equal(batch.getSnapshot().pending,1);assert.equal(await batch.submit(),true);assert.equal(retries,1);
  ui.harness.unmount();
});

test('price, language and private report drafts share the final save without section buttons',async()=>{
  const batch=createContributionBatch();const writes=[];
  const price=setup('price',{onSubmit:(id,cents)=>{writes.push(['price',id,cents]);}},batch);
  const language=setup('language',{onSubmit:code=>{writes.push(['language',code]);}},batch);
  const safety=setup('safety',{onSubmit:input=>{writes.push(['safety',input.description]);}},batch);
  price.render().find(node=>node.props.accessibilityRole==='radio').props.onPress();price.render();
  price.render().find(node=>node.props.accessibilityLabel==='Drink price in euros').props.onChangeText('6,50');price.render();
  language.render().find(node=>node.props.accessibilityRole==='radio').props.onPress();language.render();
  safety.render().find(node=>node.props.accessibilityRole==='radio').props.onPress();safety.render();
  assert.equal(await batch.submit(),false);assert.deepEqual(writes,[]);
  safety.render().find(node=>node.props.accessibilityLabel==='Private incident description').props.onChangeText('Private draft');safety.render();
  for(const ui of [price,language,safety])assert.ok(!ui.render().some(node=>node.type==='PrimaryButton'));
  assert.deepEqual(writes,[]);assert.equal(await batch.submit(),true);
  assert.deepEqual(writes,[['price',drink.id,650],['language','en'],['safety','Private draft']]);
  price.harness.unmount();language.harness.unmount();safety.harness.unmount();
});

test('edits back to an original value are still saved after another section fails',async()=>{
  const batch=createContributionBatch();const levels=[];
  const crowd=setup('crowd',{savedReport:{level:2,created_at:'2026-01-01T00:00:00Z'},onSubmit:level=>{levels.push(level);}},batch);
  batch.register('other',{fingerprint:'pending',dirty:true,valid:true,save:async()=>{throw Error('offline');}});
  crowd.render().find(node=>node.props.accessibilityLabel==='3 Moderate').props.onPress();crowd.render();
  assert.equal(await batch.submit(),false);assert.deepEqual(levels,[3]);
  crowd.render().find(node=>node.props.accessibilityLabel==='2 Quiet').props.onPress();crowd.render();
  await batch.submit();assert.deepEqual(levels,[3,2]);crowd.harness.unmount();
});
