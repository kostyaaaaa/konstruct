import type { Prediction } from '../predictions/prediction.schema.js';
import { bold, link, marked, type RichBlock, type RichText } from './rich-message.js';

/** Accuracy of past predictions at this confidence or better. */
export interface Calibration {
  accuracyPercent: number | null;
  settled: number;
}

/** `900` -> `15m`. Under a minute keeps its unit, so a 10s league is not `0m`. */
export function formatDelay(seconds: number): string {
  return seconds < 60 ? `${seconds}s` : `${Math.round(seconds / 60)}m`;
}

/**
 * Builds the prediction message.
 *
 * **Deliberately short: the call, and how far to trust it.** Nothing else.
 *
 * The rosters are not here. Ten players will not fit a phone in any shape the
 * format offers — a table crops because its columns are fixed, and a list of
 * twenty lines buries the one sentence that matters. The console renders all
 * of it properly, and the link at the end goes straight to that match, so the
 * detail is one tap away rather than in the way.
 */
export function buildReport(
  prediction: Prediction,
  options: { consoleUrl?: string; calibration?: Calibration } = {},
): RichBlock[] {
  const radiant = prediction.radiantTeamName ?? 'Radiant';
  const dire = prediction.direTeamName ?? 'Dire';
  const favoured =
    prediction.favoured === 'radiant' ? radiant : prediction.favoured === 'dire' ? dire : null;

  const blocks: RichBlock[] = [
    {
      type: 'heading',
      size: 3,
      text: favoured
        ? [bold(favoured), ` favoured · ${prediction.marginPercent}%`]
        : `${radiant} vs ${dire} — level`,
    },
    {
      type: 'paragraph',
      text: [
        `${radiant} `,
        bold(String(prediction.radiantScore)),
        ' · ',
        `${dire} `,
        bold(String(prediction.direScore)),
      ],
    },
  ];

  /* Shown from the first settled prediction. The sample size is printed
     alongside it, so "(2 settled)" carries its own warning — hiding the line
     until it is trustworthy just means never seeing whether it works. */
  const { calibration } = options;
  if (calibration && calibration.accuracyPercent !== null) {
    blocks.push({
      type: 'blockquote',
      blocks: [
        {
          type: 'paragraph',
          text: [
            'Past calls at ',
            bold(`≥${prediction.marginPercent}%`),
            ' were right ',
            bold(`${calibration.accuracyPercent}%`),
            ` of the time (${calibration.settled} settled).`,
          ],
        },
      ],
    });
  }

  if (!prediction.complete) {
    blocks.push({
      type: 'paragraph',
      text: marked('Incomplete — some players’ stats were unavailable.'),
    });
  }

  const context: RichText[] = [];
  if (prediction.leagueName) {
    context.push(prediction.leagueName);
  }
  if (prediction.streamDelaySeconds !== undefined) {
    /* Says how stale the call already is: the scoreboard arrives on the
       broadcast's delayed timeline, so a 15m league gives us the draft a
       quarter of an hour after it happened. */
    context.push(`delay ${formatDelay(prediction.streamDelaySeconds)}`);
  }
  if (options.consoleUrl) {
    context.push(link('View match', `${options.consoleUrl}/matches/${prediction.matchId}`));
  }

  if (context.length > 0) {
    blocks.push({
      type: 'footer',
      text: context.flatMap((part, index) => (index === 0 ? [part] : [' · ', part])),
    });
  }

  return blocks;
}
