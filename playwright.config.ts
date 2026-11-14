import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./e2e',timeout:90000,fullyParallel:false,workers:1,
  reporter:'list',use:{baseURL:'http://localhost:5173',channel:'chrome',headless:true,trace:'retain-on-failure',screenshot:'only-on-failure'},
  webServer:{command:'npm run dev',url:'http://localhost:4000/healthz',reuseExistingServer:!process.env.CI,timeout:120000,
    env:{PORT:'4000',APP_URL:'http://localhost:5173',MONGODB_URI:'mongodb://127.0.0.1:27017/understood-e2e?replicaSet=rs0',REDIS_URL:process.env.TEST_REDIS_URL??'redis://127.0.0.1:6379',AI_DRIVER:'mock',EMAIL_DRIVER:'console',RATE_LIMIT_ENABLED:'false'}},
});
