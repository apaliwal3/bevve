import {
  createBarHopClient,
  authService,
  barsService,
  crowdService,
} from './src/index.ts';

const client = createBarHopClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_KEY!,
  { auth: { persistSession: false } },
);

const auth = authService(client);

await auth.signIn(
  process.env.TEST_EMAIL!,
  process.env.TEST_PASSWORD!,
);

try {
  console.log('Profile:', await auth.getMyProfile());

  const bars = await barsService(client).listBars();
  console.log('Bars:', bars);

  if (bars?.length) {
    console.log(
      'Crowd:',
      await crowdService(client).getBarCrowd(bars[0].id),
    );
  }
} finally {
  await auth.signOut();
}
