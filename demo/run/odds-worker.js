// THE ODDS' WORKER (smooth-1, demo/run/odds.js): plays one sample of fights off the page's thread, the very function
// Node plays (src/run/odds.mjs tallyFights: the same fights, seeds and counting), and sends the count back by its key.
import { tallyFights } from '../../src/run/odds.mjs';

self.onmessage = ({ data }) => {
  const { key, job } = data;
  try {
    self.postMessage({ key, tally: tallyFights(job) });
  } catch (err) {
    self.postMessage({ key, error: String(err?.stack ?? err) });
  }
};
