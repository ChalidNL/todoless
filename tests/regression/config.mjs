/** Shared QA fixtures/credentials for the regression suite (no side effects). */
export const QA_USER = {
  email: process.env.QA_EMAIL || 'qa.suite@todoless.local',
  password: process.env.QA_PASSWORD || 'QaSuite12345!',
  name: 'QA Suite',
};

export const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8091';
