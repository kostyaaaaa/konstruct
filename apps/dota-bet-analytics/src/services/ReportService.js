import fs from 'fs';
import path from 'path';

import Handlebars from 'handlebars';
import nodemailer from 'nodemailer';

import { logger } from '../logger.js';
import initHandleBarsHelpers from '../utils/initHandleBarsHelpers.js';

const { EMAIL, SMTP_EMAIL, SMTP_PASSWORD } = process.env;

class ReportService {
  constructor() {
    this.sender = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: SMTP_EMAIL,
        pass: SMTP_PASSWORD,
      },
    });
    initHandleBarsHelpers();
  }

  getHTMLTemplate(data) {
    const templateSource = fs.readFileSync(
      path.resolve(import.meta.dirname, '../templates/dotaReport.hbs'),
      'utf8',
    );

    const templateCompiled = Handlebars.compile(templateSource);
    return templateCompiled(data);
  }

  async sendReport(body) {
    try {
      const html = this.getHTMLTemplate(body);
      const message = await this.sender.sendMail({
        from: `Dota-bet-analytics <${SMTP_EMAIL}>`,
        to: EMAIL,
        subject: 'Prediction',
        html,
      });
      logger.info('report sent', { messageId: message.messageId });
    } catch (err) {
      logger.error('sendReport failed', err);
    }
  }
}

export default new ReportService();
