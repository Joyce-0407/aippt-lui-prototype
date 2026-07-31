/** WPS AIPPT 设计 token，来源 .impeccable.md（Playwright 逆向提取） */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0d0d0d',
          90: 'rgba(13,13,13,.90)',
          66: 'rgba(13,13,13,.66)',
          46: 'rgba(13,13,13,.46)',
          24: 'rgba(13,13,13,.24)',
          12: 'rgba(13,13,13,.12)',
          '06': 'rgba(13,13,13,.06)',
        },
        brand: { blue: '#0a6cff', page: '#417ff9' },
        ai: { purple: '#682aef', light: '#9e75f5' },
        page: '#f2f3f5',
        ok: '#67c23a',
        warn: '#e6a23c',
        danger: '#f56c6c',
      },
      fontFamily: {
        sans: ['"PingFang SC"', '"Helvetica Neue"', '"Hiragino Sans GB"', '"Microsoft YaHei"', 'Arial', 'sans-serif'],
      },
      borderRadius: { card: '16px' },
      transitionTimingFunction: {
        wps: 'cubic-bezier(.645,.045,.355,1)',
        fast: 'cubic-bezier(.23,1,.32,1)',
      },
    },
  },
  plugins: [],
};
