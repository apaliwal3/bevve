type WelcomeContent = {
  image: number;
  imageDescription: string;
  cityLabel: string;
  kicker: string;
  title: string;
  description: string;
};

export const welcomeMock: WelcomeContent = {
  image: require('@/assets/images/welcome-nightlife.jpg'),
  imageDescription: 'Friends socializing on a city street at night',
  cityLabel: 'MILANO AFTER DARK',
  kicker: 'Continue as a local',
  title: 'Find your next spot',
  description: 'Real-time crowd, prices and honest local details for better nights out.',
};
