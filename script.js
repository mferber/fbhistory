/*
 * Script for Facebook history fetcher
 */

var MAX_PHOTO_HEIGHT = 350;
var MAX_PHOTO_WIDTH = 350;
var DEBUG = false;

var dest;
var userProfileIconSrc;

/*
 * Set up callback for completion of asynchronous Facebook SDK loading.
 * Turns off spinner, sets up event notification, and updates display.
 */
window.fbAsyncInit = function() {
  dest = document.getElementById('posts');
  
  FB.init({
    appId      : '6301310298', // App ID
    channelUrl : '//www.matthiasferber.net/dev/fb/channel.html', // Channel File
    status     : true, // check login status
    cookie     : true, // enable cookies to allow the server to access the session
    xfbml      : true  // parse XFBML
  });
  
  deactivateSpinner('fb-api-spinner');
  
  FB.getLoginStatus(window.updateFBStatus);

  FB.Event.subscribe('auth.statusChange', function(response) {
    updateFBStatus(response);
  });  
};


// Load the Facebook SDK asynchronously
(function(d, debug) {
  var js, id = 'facebook-jssdk', ref = d.getElementsByTagName('script')[0];
  if (d.getElementById(id)) {return;}
  js = d.createElement('script'); js.id = id; js.async = true;
  js.src = "//connect.facebook.net/en_US/all" + (debug ? "/debug" : "")
    + ".js";
  ref.parentNode.insertBefore(js, ref);
}(document, false));


/*
 * Log into Facebook and get required permissions
 */
window.login = function() {
  FB.login(function(response) { }, { scope: 'read_stream,user_photos' });
};


/*
 * Update the display to reflect Facebook login status (triggered by
 * status change event)
 */
window.updateFBStatus = function(response) {
  clearResults();
  if (response.status === 'connected') {
    FB.api('/me?fields=name,picture', function(response) {
      userProfileIconSrc = response.picture.data.url;
      document.getElementById('heading').textContent
        = response.name + "'s posts";
    });
  } else {
    userProfileIconSrc = undefined;
  }
  document.body.className = (response.status === 'connected'
    ? "fb-connected" : "fb-disconnected");
};


/*
 * Clear out the div where results will go
 */
window.clearResults = function() {
  while (dest.hasChildNodes()) {
    dest.removeChild(dest.firstChild);
  }
};


/*
 * Activate and deactivate the "work in progress" spinner
 * for Facebook data loading
 */
window.activateSpinner = function(id) {
  document.getElementById(id).className = 'spinner active';
};
window.deactivateSpinner = function(id) {
  document.getElementById(id).className = 'spinner inactive';
};


/*
 * Fetch the status info
 */
window.getPosts = function() {
  clearResults();
  activateSpinner('posts-spinner');
  
  FB.api('/me/posts', {}, //{ since: '2013-01-11T01:44:26', until: '2013-01-12' },
    function(response) {
      var postsUl = document.createElement('ul');
      postsUl.className = 'post-list';
    
      for (var i = 0; i < response.data.length; i++) {
        addPostListItem(response.data[i], postsUl);
      }
      
      deactivateSpinner('posts-spinner');
      
      dest.appendChild(postsUl);          
    }
  );
};


window.addPostListItem = function(itm, postsUl) {
  console.log("::" + itm.created_time + " - " + itm.message);
  
  // user icon
  var iconDiv = document.createElement('div');
  iconDiv.className = 'icon';
  if (userProfileIconSrc != undefined) {
    var icon = document.createElement('img');
    icon.className = 'user-profile-icon';
    icon.src = userProfileIconSrc;
    iconDiv.appendChild(icon);
  }
  
  // post content ("message")
  if (itm.message !== undefined) {
    var msgDiv = document.createElement('div');
    msgDiv.className = 'message';
    msgDiv.innerHTML = itm.message.replace(/[\n\r]/g, '<br>');
  }
  
  var detailsDiv = document.createElement('div');
  detailsDiv.className = 'details ' + itm.type;
  
  // populate detailsDiv depending on type of item
  switch (itm.type) {
    case 'photo':   appendPhotoDetails(itm, detailsDiv); break;
    case 'video':   appendVideoDetails(itm, detailsDiv); break;
    case 'link':    appendLinkDetails(itm, detailsDiv); break;
    default:        break;
  }
  
  // likes
  var likes = document.createElement('span');
  likes.className = 'likes';
  likes.textContent = 'Likes: '
    + (itm.likes === undefined || itm.likes.count === 0
      ? 'none' : itm.likes.count);
  
  // comments
  var comments = document.createElement('span');
  comments.className = 'comments';
  comments.textContent = 'Comments: '
    + (itm.comments === undefined || itm.comments.count === 0
      ? 'none' : itm.comments.count);
      
  // timestamp
  var timestamp = document.createElement('span');
  timestamp.className = "timestamp";
  var dt = itm.created_time.substring(0, 19);
  timestamp.textContent = new Date(dt).toLocaleString();
  
  // container for "annotations": timestamp, likes, and comments
  var annotations = document.createElement('div');
  annotations.className = 'annotations';
  annotations.appendChild(timestamp);
  var separator = document.createTextNode(' \u2022 ');  // bullet
  annotations.appendChild(separator);
  annotations.appendChild(likes);
  annotations.appendChild(separator.cloneNode(true));
  annotations.appendChild(comments);
  
  // container for everything but the icon
  var infoDiv = document.createElement('div');
  infoDiv.className = 'item-info';
  
  if (DEBUG) {
    var t = document.createTextNode(itm.id);
    infoDiv.appendChild(t);
  }
  
  if (msgDiv !== undefined) {
    infoDiv.appendChild(msgDiv)
  }
  if (detailsDiv !== undefined && detailsDiv.hasChildNodes()) {
    infoDiv.appendChild(detailsDiv);
  }
  if (annotations !== undefined) {
    infoDiv.appendChild(annotations);
  }
  
  // container li
  var li = document.createElement('li');
  li.className = 'item';
  
  li.appendChild(iconDiv);
  li.appendChild(infoDiv);
          
  // temp: append type descriptor (for debugging) -- FIXME
  /*var text = document.createElement('div');
  text.innerHTML = '<b>' + itm.type.toUpperCase() + '</b>';
  li.insertBefore(text, li.firstChild);*/
  
  // add to list
  posts.insertBefore(li, postsUl.firstChild);
};



// Populate info for a photo item
window.appendPhotoDetails = function(itm, detailsDiv) {
  var thumbnailDiv = makeThumbnailDiv(itm);
  detailsDiv.appendChild(thumbnailDiv);
  
  // fetch larger picture and substitute it for the original thumbnail
  // asynchronously; if unavailable, leave thumbnail unchanged (this
  // can happen when linking to somebody else's picture, for instance)
  var img = thumbnailDiv.firstChild;
  FB.api('/' + itm.object_id, { fields: [ 'source', 'images' ] },
    function(photo) {
      // select the largest size image that doesn't exceed a maximum
      // height or width; use the photo's native 'source' as a
      // fallback
      var src = undefined;
      var w = 0;
      var h = 0;
      var imgs = photo.images;
      if (imgs !== undefined) {
        for (var i = 0; i < imgs.length; i++) {
          if (src === undefined) {
            src = imgs[i].source;
          } else if (imgs[i].width <= MAX_PHOTO_WIDTH
              && imgs[i].height <= MAX_PHOTO_HEIGHT
              && w < imgs[i].width && h < imgs[i].height)
          {
            src = imgs[i].source;
            w = imgs[i].width;
            h = imgs[i].height;
          }
        }
      }
      if (src !== undefined) {
        img.src = src;
      }
    }
  );
};



// Populate info for a video item
window.appendVideoDetails = function(itm, detailsDiv) {
  var thumbnailDiv = makeThumbnailDiv(itm);
  
  var videoNameDiv;
  if (itm.name !== undefined) {
    videoNameDiv = document.createElement('div');
    videoNameDiv.className = 'video-name';
    videoNameDiv.textContent = itm.name;
  }
  
  var videoDescDiv;
  if (itm.description !== undefined) {
    videoDescDiv = document.createElement('div');
    videoDescDiv.className = 'video-desc';
    videoDescDiv.textContent = itm.description;
  }
  
  var videoLinkDiv = makeLinkDiv(itm);
  
  // populate container of text parts
  var detailsTextDiv = document.createElement('div');
  detailsTextDiv.className = 'details-text';
  if (videoNameDiv !== undefined) {
    detailsTextDiv.appendChild(videoNameDiv);
  }
  if (videoDescDiv !== undefined) {
    detailsTextDiv.appendChild(videoDescDiv);
  }
  if (videoLinkDiv !== undefined) {
    detailsTextDiv.appendChild(videoLinkDiv);
  }
  
  // populate main container
  if (thumbnailDiv != undefined) {
    detailsDiv.appendChild(thumbnailDiv);
  }
  detailsDiv.appendChild(detailsTextDiv);
};


// Populate info for a link item
window.appendLinkDetails = function(itm, detailsDiv) {
  // thumbnail of the link destination
  var thumbnailDiv = makeThumbnailDiv(itm);
  
  // link name
  var linkNameDiv;
  if (itm.name !== undefined) {
    linkNameDiv = document.createElement('div');
    linkNameDiv.className = 'link-name';
    linkNameDiv.textContent = itm.name;
  }
  
  // link description
  var linkDescDiv;
  if (itm.description !== undefined) {
    linkDescDiv = document.createElement('div');
    linkDescDiv.className = 'link-desc';
    linkDescDiv.textContent = itm.description;
  }
  
  // link anchor
  var linkLinkDiv = makeLinkDiv(itm);
  
  // populate container of text parts
  var detailsTextDiv = document.createElement('div');
  detailsTextDiv.className = 'details-text';
  if (linkNameDiv !== undefined) detailsTextDiv.appendChild(linkNameDiv);
  if (linkDescDiv !== undefined) detailsTextDiv.appendChild(linkDescDiv);
  if (linkLinkDiv !== undefined) detailsTextDiv.appendChild(linkLinkDiv);
  
  // populate container
  if (thumbnailDiv != undefined) detailsDiv.appendChild(thumbnailDiv);
  detailsDiv.appendChild(detailsTextDiv);
};


// Make a thumbnail image div for an item, if item has one;
// class = 'thumbnail'
window.makeThumbnailDiv = function(itm) {
  if (itm.picture !== undefined) {
    var img = document.createElement('img');
    img.src = itm.picture;
    
    imgDiv = document.createElement('div');
    imgDiv.className = 'thumbnail';
    imgDiv.appendChild(img);          
    return imgDiv;
  }
  return undefined;
};


// Make an anchor div linking to external page for an item, if item
// has one; class = 'anchor'
window.makeLinkDiv = function(itm) {
  if (itm.link != '') {
    var linkAnchor = document.createElement('a');
    linkAnchor.setAttribute('href', itm.link);
    linkAnchor.textContent = '\u2192 ' + itm.link;
    
    var linkAnchorDiv = document.createElement('div');
    linkAnchorDiv.className = 'anchor';
    linkAnchorDiv.appendChild(linkAnchor);
    return linkAnchorDiv;
  }
  return undefined;
};

