import { OptionalContributionCard } from './optional-contribution-card';
import { StyleSheet, Text, View } from 'react-native';
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
  const venue=catalog.venues.find(row=>row.id===barId);
  const report=[...state.crowds].filter(row=>row.bar_id===barId).sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id))[0]??null;
  const review=state.bathrooms.find(row=>row.bar_id===barId)??null;
  if(!venue)return null;
  return <View style={styles.section}>
    <AccountContributionFeedback />
    {!catalog.impressions[barId] ? <Text style={styles.note}>{t('Save your impression to continue to optional contributions.')}</Text>
      : state.status==='ready' && actions.map(action=>{
        const key=contributionKey({kind:action.kind,barId});
        const op=state.operations[key]??emptyContributionOperation;
        const input=op.request?.input;
        const feedback={pending:Boolean(op.request),saving:op.saving,error:op.error,saved:op.saved,
          retry:()=>{if(op.request)return state.retry(key,op.request.id);}};
        const cancel=()=>{};
        const submit=(input:ContributionInput)=>state.submit(input,op.version);
        return <OptionalContributionCard key={action.kind} titleKey={action.title} hintKey={action.hint} icon={action.icon} disabled={op.saving}>
            {action.kind==='crowd' ? <CrowdReportForm savedReport={report} feedback={feedback}
              initialLevel={input?.kind==='crowd'?input.level:undefined}
              onSubmit={level=>submit({kind:'crowd',barId,level})} onCancel={cancel}/>
              : action.kind==='bathroom' ? <BathroomReviewForm savedReview={review} feedback={feedback}
                initialScores={input?.kind==='bathroom'?input:undefined}
                onSubmit={scores=>submit({kind:'bathroom',barId,...scores})} onCancel={cancel}/>
                : <DrinkPriceForm catalog={catalog.drinks} prices={catalogReadData(venue).drinks} feedback={feedback}
                  initialPrice={input?.kind==='price'?input:undefined}
                  onSubmit={(drinkId,priceCents)=>submit({kind:'price',barId,drinkId,priceCents})} onCancel={cancel}/>}
        </OptionalContributionCard>;
      })}
  </View>;
}
const styles=StyleSheet.create({
  section:{gap:theme.spacing.md},title:{color:theme.colors.text,fontFamily:theme.fonts.heading,fontSize:17},
  note:{color:theme.colors.textMuted,fontFamily:theme.fonts.body,fontSize:12,lineHeight:19},
});
