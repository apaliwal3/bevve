import assert from 'node:assert/strict';
import { test } from 'node:test';
import { elements, loadNativeModule, nativeStub } from './helpers/native-module.mjs';
import { createTranslator } from '../src/localization/translation.ts';
import { createLocaleFormatters } from '../src/localization/formatting.ts';

const theme=loadNativeModule('src/constants/theme.ts');
const translation={useTranslation:()=>({t:createTranslator('en'),format:createLocaleFormatters('en')})};

test('the shared scroll view supports pulling on short pages and shows the native themed refresh indicator',()=>{
  const {ScreenContainer}=loadNativeModule('src/components/screen-container.tsx',{
    'react-native':{...nativeStub,ScrollView:'ScrollView',RefreshControl:'RefreshControl'},
    'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},'@/constants/theme':theme,
  });
  const nodes=props=>[...elements(ScreenContainer(props))];let refreshes=0;
  let scroll=nodes({children:null,onRefresh:()=>refreshes++,refreshing:true}).find(node=>node.type==='ScrollView');
  assert.equal(scroll.props.alwaysBounceVertical,true);
  const control=scroll.props.refreshControl;
  assert.equal(control.type,'RefreshControl');assert.equal(control.props.refreshing,true);
  assert.equal(control.props.tintColor,theme.BevveTheme.colors.purpleLight);
  control.props.onRefresh();assert.equal(refreshes,1);
  scroll=nodes({children:null}).find(node=>node.type==='ScrollView');
  assert.equal(scroll.props.refreshControl,undefined);assert.equal(scroll.props.alwaysBounceVertical,undefined);
});

function setup(){
  const calls=[];
  const source=name=>({refreshing:false,refresh:async()=>{calls.push(name);}});
  const catalog={...source('catalog'),status:'ready',venues:[],drinks:[],impressions:{},userId:'user'};
  const comparisons={...source('comparisons'),status:'ready',rankings:{completedCount:0,entries:[]}};
  const contributions={...source('contributions'),status:'ready',crowds:[],bathrooms:[],prices:[]};
  const languages={...source('languages'),queueRefreshing:false,refreshQueue:async()=>{calls.push('language queue');}};
  const savedBars=source('saved bars');
  const safety={...source('safety'),queueRefreshing:false,refreshQueue:async()=>{calls.push('incident queue');}};
  const module=loadNativeModule('src/features/catalog/account-routes.tsx',{
    '@/features/saved-bars/saved-bars-section':{SavedBarsSection:'SavedBarsSection'},
    '@/features/saved-bars/saved-bars-provider':{useSavedBars:()=>savedBars},
    react:{useState:initial=>[initial,()=>{}]},'expo-router':{router:{}},
    '@/components/primary-button':{PrimaryButton:'PrimaryButton'},'@/components/screen-container':{ScreenContainer:'ScreenContainer'},
    '@/features/profile/account-profile-screen':{AccountProfileScreen:'AccountProfileScreen'},
    '@/constants/theme':theme,'@/features/auth/account-panel':{AccountPanel:'AccountPanel'},
    '@/features/venues/bar-details-screen':{},'@/features/venues/bar-details-navigation':{},
    '@/features/prices/price-comparison-screen':{},'@/features/prices/price-comparison':{},'@/features/prices/price-navigation':{},
    '@/features/profile/profile-activity-components':{ProfileActivitySection:'ProfileActivitySection',ProfileActivityRow:'ProfileActivityRow'},
    '@/features/profile/profile-activity':{selectProfileContributions:()=>({counts:{impressions:0,crowdReports:0,bathroomReviews:0,priceObservations:0},impressions:[],crowds:[],bathrooms:[],prices:[]})},
    '@/features/impressions/impression-selector':{},'@/features/venues/venue-details':{},'@/localization/language-provider':translation,
    './catalog-adapters':{savedImpressions:()=>[],catalogVenue:row=>row},'./catalog-feedback':{CatalogFeedback:'CatalogFeedback'},
    './account-impression-editor':{},
    '@/features/comparisons/account-comparisons-provider':{useAccountComparisons:()=>comparisons},
    '@/features/comparisons/account-comparison-panel':{AccountComparisonFeedback:'AccountComparisonFeedback'},
    '@/features/rankings/ranked-venue-row':{RankedVenueRow:'RankedVenueRow'},
    '@/features/contributions/account-contributions-provider':{useAccountContributions:()=>contributions},
    '@/features/contributions/account-languages-provider':{useAccountLanguages:()=>languages},
    '@/features/contributions/account-safety-provider':{useAccountSafety:()=>safety},
    '@/features/contributions/account-contribution-panel':{AccountContributionFeedback:'AccountContributionFeedback'},
    '@/features/contributions/account-language-panel':{AccountLanguageHistory:'AccountLanguageHistory',AccountLanguageModeration:'AccountLanguageModeration'},
    '@/features/contributions/account-safety-panel':{AccountIncidentHistory:'AccountIncidentHistory',AccountIncidentModeration:'AccountIncidentModeration'},
    '@/features/location/account-location-provider':{},'@/features/location/venue-distance':{},
  });
  return {catalog,comparisons,contributions,languages,safety,savedBars,calls,render(name){return module[name]({catalog});}};
}

test('Rankings pulls refresh comparisons and venues together, including empty and failed reads',()=>{
  const ui=setup();ui.comparisons.status='error';ui.catalog.status='error';
  let screen=ui.render('AccountRankingsScreen');screen.props.onRefresh();assert.deepEqual(ui.calls,['comparisons','catalog']);
  assert.ok(![...elements(screen)].some(node=>node.props.label==='Refresh rankings'));
  ui.comparisons.refreshing=true;screen=ui.render('AccountRankingsScreen');assert.equal(screen.props.refreshing,true);
  screen.props.onRefresh();assert.equal(ui.calls.length,2);ui.comparisons.refreshing=false;ui.catalog.refreshing=true;
  assert.equal(ui.render('AccountRankingsScreen').props.refreshing,true);
});
