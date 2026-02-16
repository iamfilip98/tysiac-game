import type { Preview } from '@storybook/react';
import { withThemeByDataAttribute } from '@storybook/addon-themes';
import '../src/app/globals.css';

const preview: Preview = {
  parameters: {
    backgrounds: {
      disable: true,
    },
    layout: 'centered',
  },
  decorators: [
    // Theme switching decorator
    withThemeByDataAttribute({
      themes: {
        Classic: 'classic',
        Dark: 'dark',
        Chocolate: 'chocolate',
        Midnight: 'midnight',
        Burgundy: 'burgundy',
        Purple: 'purple',
      },
      defaultTheme: 'Classic',
      attributeName: 'data-theme',
    }),
    // Card style switching via toolbar
    (Story, context) => {
      const cardStyle = context.globals.cardStyle || 'auto';
      document.documentElement.setAttribute('data-card-style', cardStyle);
      document.documentElement.setAttribute('data-animations', 'on');
      return Story();
    },
  ],
  globalTypes: {
    cardStyle: {
      description: 'Card visual style',
      toolbar: {
        title: 'Card Style',
        icon: 'paintbrush',
        items: [
          { value: 'auto', title: 'Auto (theme default)' },
          { value: 'white', title: 'White cards' },
          { value: 'black', title: 'Black cards' },
        ],
        dynamicTitle: true,
      },
    },
  },
};

export default preview;
