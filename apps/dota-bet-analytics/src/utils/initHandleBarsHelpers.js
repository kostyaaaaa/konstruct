import Handlebars from 'handlebars';

const initHandleBarsHelpers = () => {
  // Rank
  Handlebars.registerHelper('isAwesomeRank', function (value) {
    return value <= 10;
  });
  Handlebars.registerHelper('isGoodRank', function (value) {
    return value > 10 && value <= 100;
  });
  Handlebars.registerHelper('isNormalRank', function (value) {
    return value > 100 && value <= 300;
  });
  Handlebars.registerHelper('isBadRank', function (value) {
    return value > 300 && value <= 1000;
  });
  Handlebars.registerHelper('isAwfulRank', function (value) {
    return value > 1000;
  });

  // Popular
  Handlebars.registerHelper('isAwesomePopular', function (value) {
    return value <= 10;
  });
  Handlebars.registerHelper('isGoodPopular', function (value) {
    return value > 10 && value <= 20;
  });
  Handlebars.registerHelper('isNormalPopular', function (value) {
    return value > 20 && value <= 50;
  });
  Handlebars.registerHelper('isBadPopular', function (value) {
    return value > 50 && value <= 90;
  });
  Handlebars.registerHelper('isAwfulPopular', function (value) {
    return value > 90;
  });

  // Total games
  Handlebars.registerHelper('isAwesomeTotalGames', function (value) {
    return value >= 500;
  });
  Handlebars.registerHelper('isGoodTotalGames', function (value) {
    return value < 500 && value >= 200;
  });
  Handlebars.registerHelper('isNormalTotalGames', function (value) {
    return value < 200 && value >= 100;
  });
  Handlebars.registerHelper('isBadTotalGames', function (value) {
    return value < 100 && value >= 35;
  });
  Handlebars.registerHelper('isAwfulTotalGames', function (value) {
    return value < 35;
  });

  // Winrate
  Handlebars.registerHelper('isAwesomeWinrate', function (value) {
    return value >= 65;
  });
  Handlebars.registerHelper('isGoodWinrate', function (value) {
    return value < 65 && value >= 55;
  });
  Handlebars.registerHelper('isNormalWinrate', function (value) {
    return value < 55 && value >= 50;
  });
  Handlebars.registerHelper('isBadWinrate', function (value) {
    return value < 50 && value >= 40;
  });
  Handlebars.registerHelper('isAwfulWinrate', function (value) {
    return value < 40;
  });
};

export default initHandleBarsHelpers;
