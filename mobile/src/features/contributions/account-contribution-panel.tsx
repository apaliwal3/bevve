import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/app-icon';
import { PrimaryButton } from '@/components/primary-button';
import { BevveTheme as theme } from '@/constants/theme';
import type { AccountCatalogValue } from '@/features/catalog/catalog-provider';
import { catalogReadData } from '@/features/catalog/catalog-adapters';
import { useTranslation } from '@/localization/language-provider';
import type { ContributionInput } from '../../../../shared/contribution-contracts';
import { useAccountContributions } from './account-contributions-provider';
import { contributionKey, emptyContributionOperation } from './account-contribution-store';
import { CrowdReportForm } from './crowd-report-form';
import { BathroomReviewForm } from './bathroom-review-form';
import { DrinkPriceForm } from './drink-price-form';

const actions = [
  { kind:'crowd',title:'Report crowd',hint:'Share the live vibe',icon:'crowd' },
  { kind:'bathroom',title:'Rate bathrooms',hint:'Cleanliness, accessibility and waiting time',icon:'bathroom' },
  { kind:'price',title:'Update drink prices',hint:'Suggest menu prices',icon:'euro' },
] as const;

export function AccountContributionFeedback(){
  const state=useAccountContributions(),{t}=useTranslation();
  if(state.status==='ready' && !state.error)return null;
  return <View style={styles.section}>
    <Text accessibilityRole={state.error?'alert':undefined} style={styles.note}>{state.error ? state.status==='ready'
      ? t('Could not refresh. Showing the last loaded data.') : t('Your contributions could not be loaded.') : t('Loading your contributions…')}</Text>
    {state.error && <PrimaryButton label={t('Retry contributions')} disabled={state.refreshing} variant="secondary" onPress={()=>{void state.refresh();}} />}
  </View>;
}

export function AccountContributionPanel({catalog,barId}:{catalog:AccountCatalogValue;barId:string}){
  const state=useAccountContributions(),{t}=useTranslation();
  const [expanded,setExpanded]=useState<Partial<Record<ContributionInput['kind'],boolean>>>({});
  const venue=catalog.venues.find(row=>row.id===barId);
  const report=[...state.crowds].filter(row=>row.bar_id===barId).sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id))[0]??null;
  const review=state.bathrooms.find(row=>row.bar_id===barId)??null;
  if(!venue)return null;
  return <View style={styles.section}>
    <Text accessibilityRole="header" style={styles.title}>{t('Optional contributions')}</Text>
    <Text style={styles.note}>{t('Choose any contribution, or close when you are done. Saved contributions are kept in your account.')}</Text>
    <AccountContributionFeedback />
    {!catalog.impressions[barId] ? <Text style={styles.note}>{t('Save your impression to continue to optional contributions.')}</Text>
      : state.status==='ready' && actions.map(action=>{
        const key=contributionKey({kind:action.kind,barId});
        const op=state.operations[key]??emptyContributionOperation;
        const input=op.request?.input;
        const feedback={pending:Boolean(op.request),saving:op.saving,error:op.error,saved:op.saved,
          retry:()=>{if(op.request)void state.retry(key,op.request.id).catch(()=>{});}};
        const cancel=()=>setExpanded(previous=>({...previous,[action.kind]:false}));
        const submit=(input:ContributionInput)=>{void state.submit(input,op.version).catch(()=>{});};
        return <View key={action.kind} style={styles.card}>
          <Pressable accessibilityRole="button" accessibilityLabel={t(action.title)} accessibilityState={{expanded:Boolean(expanded[action.kind])}}
            disabled={op.saving} onPress={()=>setExpanded(previous=>({...previous,[action.kind]:!previous[action.kind]}))} style={styles.summary}>
            {action.icon==='euro' ? <Text accessible={false} style={styles.euro}>€</Text> : <AppIcon name={action.icon} size={20} color={theme.colors.purpleLight} />}
            <View style={styles.copy}><Text style={styles.title}>{t(action.title)}</Text><Text style={styles.note}>{t(action.hint)}</Text></View>
            <AppIcon name="chevron" size={16} color={theme.colors.purpleLight}/>
          </Pressable>
          {expanded[action.kind] && <View style={styles.form}>
            {action.kind==='crowd' ? <CrowdReportForm savedReport={report} feedback={feedback}
              initialLevel={input?.kind==='crowd'?input.level:undefined}
              onSubmit={level=>submit({kind:'crowd',barId,level})} onCancel={cancel}/>
              : action.kind==='bathroom' ? <BathroomReviewForm savedReview={review} feedback={feedback}
                initialScores={input?.kind==='bathroom'?input:undefined}
                onSubmit={scores=>submit({kind:'bathroom',barId,...scores})} onCancel={cancel}/>
                : <DrinkPriceForm catalog={catalog.drinks} prices={catalogReadData(venue).drinks} feedback={feedback}
                  initialPrice={input?.kind==='price'?input:undefined}
                  onSubmit={(drinkId,priceCents)=>submit({kind:'price',barId,drinkId,priceCents})} onCancel={cancel}/>}
          </View>}
        </View>;
      })}
  </View>;
}
const styles=StyleSheet.create({
  section:{gap:theme.spacing.md},title:{color:theme.colors.text,fontFamily:theme.fonts.heading,fontSize:17},
  note:{color:theme.colors.textMuted,fontFamily:theme.fonts.body,fontSize:12,lineHeight:19},
  card:{borderWidth:1,borderColor:theme.colors.border,borderRadius:theme.radii.card,backgroundColor:theme.colors.surfaceRaised},
  summary:{minHeight:72,padding:theme.spacing.md,flexDirection:'row',gap:theme.spacing.md,alignItems:'center'},
  copy:{flex:1,gap:theme.spacing.xs},form:{padding:theme.spacing.md},
  euro:{color:theme.colors.purpleLight,fontFamily:theme.fonts.bodyBold,fontSize:24},
});
