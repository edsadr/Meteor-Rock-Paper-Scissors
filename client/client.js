/* 
  Meteor accounts services config, we are just using github, usually you configure every service
*/
Accounts.ui.config({
  requestPermissions: {
    github: ['user', 'user:email']    
  },
  passwordSignupFields: 'USERNAME_AND_EMAIL'
});

//Making games collection available for clients
Games = new Meteor.Collection('games');

//Subscribing to collections so we can hear for changes reactively
Meteor.subscribe("games");
Meteor.subscribe("directory");

/*
Below are the functions used by Handlebar helpers and template events
*/

//Function returning the string for game buttons used by 2 handlebar helpers
function showButtons(){
   return new Handlebars.SafeString(
       "<div class=\"btn-group\"><a id=\"rock\" class=\"btn gamebutton\" href=\"#\"><i class=\"icon-certificate\"></i> Rock</a><a id=\"paper\" class=\"btn gamebutton\" href=\"#\"><i class=\"icon-file\"></i> Paper</a><a id=\"scissors\" class=\"btn gamebutton\" href=\"#\"><i class=\"icon-hand-right\"></i> Scissors</a></div>"  
    );
}

//Function returning the image for a player move depending on who is watching and the game status
function showImage(image,game){
  cuser=Meteor.userId();

  if((image == 'owner' && game.owner_play == null) || (image == 'guest' && game.guest_play == null)){
        return "waiting";
  }

  if((image=='owner' &&  cuser == game.owner) || (image=='owner' && game.game_status != 'waiting')){
    return game.owner_play;
  }
  else if((image=='guest' &&  cuser == game.guest) || (image=='guest' && game.game_status != 'waiting')){    
    return game.guest_play;
  }
  else{
    return 'ready';
  }
}

//Function getting the user email so we can get the gravatar later
function userEmail(userId) {   
  user=Meteor.users.findOne(userId);
  if(user!=null){
    if (user.emails && user.emails.length)
      return user.emails[0].address;   
    if (user.services && user.services.github && user.services.github.email)          
      return user.services.github.email;    
    return null;
  }
  else{
    return null;
  }            
}

//Function checking the game status so it can be judged if both players already set a move, it runs in an interval for the owner every time he plays
function checkGame(){
  if(Session.get('current_game')){
    Meteor.call('judgeGame',Session.get('current_game'),function(error,result){
      if(result){
        deleteInterval()        
        Meteor.setTimeout(function(){
          Meteor.call('resetGame',Session.get('current_game'));
        },3000);        
      }      
    });
  }
}

//Function clearing intervals if the user has any running
function deleteInterval(){
  if(Session.get('current_interval')){
     Meteor.clearInterval(Session.get('current_interval'));
     Session.set('current_interval', null);
  }
}

/* 
Handlebars helpers run code from the templates when they are created or updated
*/

//Helper getting the gravatar image url for users
Handlebars.registerHelper('user_image', function(userid) {         
  email=userEmail(userid);
  image='';
  if(email!=null){
    image=Gravatar.imageUrl(email); 
  }    
  return image;
});

//Helper displaying the create new game button if is a registered user
Handlebars.registerHelper('create_button', function() {               
  if(Meteor.userId()){
    return new Handlebars.SafeString(
      "<button id=\"create_game\" class=\"btn btn-success\" type=\"button\">Create new game</button>"
      );
  }  
});

//Helper displaying waiting if the string passed is null
Handlebars.registerHelper('null_filter', function(value) {               
  if(value != null)
    return value;
  return 'waiting';
});

//Helper getting a prettier version of the game name
Handlebars.registerHelper('game_name', function(game) {               
  return this.owner_username+" vs "+this.guest_username;
});

//Helper displaying the back to current game button if the user is in the lobby and already started a game
Handlebars.registerHelper('back_button', function() {               
  if(Session.get('current_game')){
    return new Handlebars.SafeString(
      "<button id=\"back_game\" class=\"btn btn-info\" type=\"button\">Back to current game</button>"
      );
  }  
});

//Helper displaying available actions over a game depending of the user watching and the game status
Handlebars.registerHelper('action_button', function(game) {     
  cuser=Meteor.userId();
  if(cuser){
    if(game.owner != cuser){
      return new Handlebars.SafeString(
        "<button class=\"btn btn-mini btn-warning join\" type=\"button\">Join</button>"
        );
    }  
    else{
      return new Handlebars.SafeString(
        "<button class=\"btn btn-mini btn-danger delete\" type=\"button\" >Delete</button>"
        );
    }  
  }
});

//Helper displaying the delete game button if the user watching is the owner or the guest for the game
Handlebars.registerHelper('end_button', function(game) {               
  cuser=Meteor.userId();
  if((cuser == game.owner || cuser == game.guest) && !game.ended){
    return new Handlebars.SafeString(
      "<button id=\"end_game\" class=\"btn btn-danger\" type=\"button\">End this game</button>"
      );
  }
  else if(game.ended){
    return new Handlebars.SafeString(
      "<button id=\"back_home\" class=\"btn btn-danger\" type=\"button\">Game ended, exit</button>"
      );
  }  
});

//Helper controlling the game buttons for the player owner of the game
Handlebars.registerHelper('game_buttons_owner', function(game) {               
  if(game.owner==Meteor.userId() && game.owner_play == null && game.started){
    return showButtons();
  }
});

//Helper controlling the game buttons for the player guest of the game
Handlebars.registerHelper('game_buttons_guest', function(game) {               
  if(game.guest==Meteor.userId() && game.guest_play == null){
    return showButtons();
  }  
});

//Helper showing the move image for the player owner of the game
Handlebars.registerHelper('game_image_owner', function(game) {               
  return showImage('owner',game);
});

//Helper showing the move image for the player guest of the game
Handlebars.registerHelper('game_image_guest', function(game) {               
  return showImage('guest',game);
});

/* Templates events, most of them always calling a Meteor method in the server, some using async */

//Events for the home template
Template.home.events({
  //Defining click for the button creating a new game
 'click #create_game': function () {
    Meteor.call('createGame',function(error,result){
      if(!error){
        Session.set('current_game', result);         
        Meteor.call('setCurrentGame',result);
        Router.go(Router.path('game', {_id: result}));
      }
    });
  },
  //Defining click for the back to current game button
  'click #back_game': function(){
    deleteInterval();
    Session.set('current_interval', Meteor.setInterval(checkGame,4000));
    Router.go(Router.path('game', {_id: Session.get('current_game')}));
  },
  //Defining click for the join game button
  'click .join': function(){
    gameId=this._id;
    Meteor.call('joinGame',this._id,function(error,result){
      if(result){
        Meteor.call('setCurrentGame',gameId);
        Session.set('current_game', gameId);
        Router.go(Router.path('game', {_id: gameId}));
      }
    });       
  },
  //Defining click for the delete game button
  'click .delete': function(){
    Meteor.call('deleteGame',this._id,function(error,result){
      if(result){
        Meteor.call('setCurrentGame',null);
        Session.set('current_game', null);
      }
    });    
  },
  //Defining click for the watch game button
  'click .watch': function(){
    Router.go(Router.path('game', {_id: this._id}));
  },  
});

//Events for the game template
Template.game.events({
  //Defining click for move buttons
  'click .gamebutton': function(e){
    Meteor.call('setMove',this._id,e.currentTarget.id);
    deleteInterval();  
    Session.set('current_interval', Meteor.setInterval(checkGame,4000));          
  },
  //Defining click for end game button
  'click #end_game': function(){
    deleteInterval();
    Meteor.call('setCurrentGame',null);
    Session.set('current_game', null);
    Meteor.call('endGame',this._id);
    Router.go('/');
  },
  //Defining click for back home button
  'click #back_home': function(){
    deleteInterval();
    Meteor.call('setCurrentGame',null);
    Session.set('current_game', null);    
    Router.go('/');
  }
});