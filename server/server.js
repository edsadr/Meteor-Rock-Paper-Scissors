//Creating the collection storing games
Games = new Meteor.Collection('games');

/*
Publishing the collection for clients 
(We did this in a hurry in a real application we will just publish custom fields to avoid security issues)
Due to this is possible to cheat in the games... I would like if you take your time  studying how to cheat in games
*/
Meteor.publish('games', function (id) {
	return Games.find({});
});

/*
Publishing users info... this one is a bit more restrictive than the one above
*/
Meteor.publish("directory", function () {
  return Meteor.users.find({}, {fields: {emails: 1, services: 1, profile: 1, username: 1, current_game: 1}});
});

/*
Here we define the methods to be called from the client controlling all games operations
*/
Meteor.methods({
	//Creating a game
	createGame: function () {
		if(this.userId){
			cgame=Games.findOne({owner: this.userId, ended: false});
			if( cgame != null){
				Games.update({_id: cgame._id}, {$set: {ended: true}});
			}
			gid=Games.insert({owner: this.userId, owner_username: getUserName(), guest: null, guest_username: null,started: false, ended: false,total_games: 0,ties: 0, owner_wins: 0,owner_play: null, guest_wins: 0, guest_play: null, game_status: 'waiting', game_log: 'Game started'});
			return gid;
		}
	},
	//A guest joining a game
	joinGame: function(gameId){
		cgame=Games.findOne({_id: gameId});
		if(!cgame.started && cgame.guest == null){
			Games.update({_id: gameId}, {$set: {guest: this.userId, guest_username: getUserName(), started: true, game_log: 'Game started'}});
			return true;
		}
		return false;
	},
	//Setting the current game for an user
	setCurrentGame: function(gameId){
		Meteor.users.update({_id: this.userId}, {$set:{current_game: gameId}});
	},
	//Setting the move for a game in course
	setMove: function(gameId,move){
		cgame= Games.findOne({_id: gameId});
		if(this.userId == cgame.owner){
			Games.update({_id: gameId}, {$set: {owner_play: move}});		
		}
		else if(this.userId == cgame.guest){
			Games.update({_id: gameId}, {$set: {guest_play: move}});
		}
		return false;
	},
	//Deciding who wins the current battle
	judgeGame: function(gameId){
		cgame= Games.findOne({_id: gameId});
		if(cgame.owner_play != null && cgame.guest_play !=null && cgame.owner == this.userId && cgame.started){

			if(cgame.owner_play == cgame.guest_play){
				Games.update({_id: gameId}, {$inc: {ties: 1,total_games: 1}, $set: {game_status: 'judged',game_log: 'Tie with '+cgame.owner_play+'<br/>'+cgame.game_log}});
			}
			else if((cgame.owner_play=='rock' && cgame.guest_play=='scissors') || (cgame.owner_play=='scissors' && cgame.guest_play=='paper') || (cgame.owner_play=='paper' && cgame.guest_play=='rock')){
				Games.update({_id: gameId}, {$inc: {owner_wins: 1,total_games: 1}, $set: {game_status: 'judged',game_log: cgame.owner_username+' wins with '+cgame.owner_play+'<br/>'+cgame.game_log}});
			}
			else{
				Games.update({_id: gameId}, {$inc: {guest_wins: 1,total_games: 1}, $set: {game_status: 'judged',game_log: cgame.guest_username+' wins with '+cgame.guest_play+'<br/>'+cgame.game_log}});
			}

			return true;
		}
		return false;
	},
	//Resetting the game after judge it
	resetGame: function(gameId){
		Games.update({_id: gameId}, {$set: {owner_play: null, guest_play: null, game_status: 'waiting'}});
	},
	//Ending the game
	endGame: function(gameId){
		cgame= Games.findOne({_id: gameId});
		Games.update({_id: gameId}, {$set: {ended: true, game_log: 'Game ended by '+getUserName()+'<br/>'+cgame.game_log}});
	},
	//Deleting the game
	deleteGame: function(gameId){
		cgame= Games.findOne({_id: gameId});
		if(cgame && this.userId == cgame.owner){
			Games.remove({_id: gameId});
			return true;
		}
		return false;
	}
});

//Getting the username easier
function getUserName() {
  user=Meteor.user();  
  if (user.profile && user.profile.name){
    return user.profile.name;
  }  
  return user.username;
};