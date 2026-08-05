import mongoose from 'mongoose';

const { Schema } = mongoose;

const MatchSchema = new Schema({
  id: { type: String, unique: true, required: true },
  direTeamName: { type: String, required: true },
  radiantTeamName: { type: String, required: true },
  radiantStats: { type: Number, required: true },
  direStats: { type: Number, required: true },
  winTeam: { type: String, default: '' },
});

const MatchModel = mongoose.model('Matches', MatchSchema);

export default MatchModel;
