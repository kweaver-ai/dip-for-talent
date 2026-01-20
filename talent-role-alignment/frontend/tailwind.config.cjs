module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#0f1c2e',
          700: '#20344f',
          500: '#3b556f',
        },
        mist: {
          50: '#f4f7fb',
          100: '#e9eef4',
          200: '#d5dfea',
        },
        surge: {
          500: '#2fbf91',
          600: '#1ea57b',
        },
        ember: {
          500: '#f9734b',
          600: '#e45733',
        }
      },
      boxShadow: {
        card: '0 10px 30px rgba(15, 28, 46, 0.08)',
      },
    },
  },
  plugins: [],
};
