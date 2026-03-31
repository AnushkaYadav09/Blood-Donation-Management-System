import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { startReminderCron } from './services/notificationService';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startReminderCron();
});
