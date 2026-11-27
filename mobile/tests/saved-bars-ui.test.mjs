import assert from 'node:assert/strict';
import { test } from 'node:test';
import { elements,loadNativeModule } from './helpers/native-module.mjs';
import { createTranslator } from '../src/localization/translation.ts';
import { createLocaleFormatters } from '../src/localization/formatting.ts';
import { createSavedBarsStore } from '../src/features/saved-bars/saved-bars-store.ts';
import { userId,barId,at,venue } from './helpers/catalog-fixtures.mjs';
import { catalogVenue } from '../src/features/catalog/catalog-adapters.ts';
const theme=loadNativeModule('src/constants/theme.ts');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup(repository=null){
  const store=createSavedBarsStore(userId,repository,()=>at);const stop=store.start();
  const shared={'@/constants/theme':theme,'@/components/app-icon':{AppIcon:'AppIcon'},
    '@/localization/language-provider':{useTranslation:()=>({t:createTranslator('en'),format:createLocaleFormatters('en')})},
    './saved-bars-provider':{useSavedBars:()=>({...store.getSnapshot(),setSaved:store.setSaved,refresh:store.refresh})}};
  const button=loadNativeModule('src/features/saved-bars/bookmark-button.tsx',shared);
  const section=loadNativeModule('src/features/saved-bars/saved-bars-section.tsx',{...shared,
    '@/components/primary-button':{PrimaryButton:'PrimaryButton'},'@/features/comparisons/comparison-state':{parseUuid:id=>id},
    '@/features/profile/profile-activity-components':{ProfileActivityRow:'ProfileActivityRow'},'./bookmark-button':button});
  return {store,stop,button:()=>button.BookmarkButton({barId,name:'Test bar'}),section:props=>section.SavedBarsSection({venues:[],onOpenVenue(){},...props})};
}

test('bookmark controls stop card navigation, toggle icons only after confirmation and support removing from either screen',async()=>{
  const ui=setup();let stopped=0;let button=ui.button();
  assert.equal(button.props.accessibilityLabel,'Save Test bar to Want to visit');
  button.props.onPress({stopPropagation(){stopped++;}});assert.equal(stopped,1);
  assert.equal(ui.button().props.disabled,true);await tick();button=ui.button();
  assert.equal(button.props.accessibilityState.selected,true);assert.equal([...elements(button)].find(node=>node.type==='AppIcon').props.name,'bookmarkFilled');
  button.props.onPress({stopPropagation(){}});await tick();assert.equal(ui.button().props.accessibilityState.selected,false);ui.stop();
});

test('offline updates show a retry action and keep the previous bookmark state',async()=>{
  let fail=true;const ui=setup({load:async()=>[],setSaved:async()=>{if(fail)throw Error('offline');return{user_id:userId,bar_id:barId,created_at:at};}});await tick();
  ui.button().props.onPress({stopPropagation(){}});await tick();let button=ui.button();
  assert.equal(button.props.accessibilityLabel,'Retry saving Test bar');assert.equal(button.props.accessibilityState.selected,false);
  assert.ok([...elements(button)].some(node=>node.props.children==='Retry'));
  fail=false;button.props.onPress({stopPropagation(){}});await tick();assert.equal(ui.button().props.accessibilityState.selected,true);ui.stop();
});

test('Want to visit has an empty state, opens saved venue details, and lets unavailable venues be removed',async()=>{
  const ui=setup();assert.ok([...elements(ui.section())].some(node=>node.props.children==='No saved bars yet'));
  await ui.store.setSaved(barId,true);let opened;
  let section=ui.section({venues:[catalogVenue(venue())],onOpenVenue:id=>{opened=id;}});
  const row=[...elements(section)].find(node=>node.type==='ProfileActivityRow');row.props.onPress();assert.equal(opened,barId);
  assert.equal(row.props.venue.available,true);
  section=ui.section();assert.equal([...elements(section)].find(node=>node.type==='ProfileActivityRow').props.venue.available,false);
  assert.ok([...elements(section)].some(node=>node.props.barId===barId));
  await ui.store.setSaved(barId,false);assert.ok([...elements(ui.section())].some(node=>node.props.children==='No saved bars yet'));ui.stop();
});
