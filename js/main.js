var map;

// Create a new blank array for all the listing markers.
//var markers = [];
//knockout view-model
var ViewModel = function() {
    var self = this;
    self.currentFilter = ko.observable("");
    self.filteredLocations = ko.observable(locations);
    self.applyFilter = (function(data) {              
            self.filteredLocations(locations.filter(function(value) {
                return value.title.toLowerCase().includes(self.currentFilter().toLowerCase());
            }));      
    });   

    self.filteredLocations.subscribe(function(newValue) {        
        clearMarkers(locations);
        showMarkers(newValue);
    });

    self.currentSelected = ko.observable(0);
    self.currentSelected.subscribe(function(newValue) {
        $.each(locations, function(i, location) {
            if (location.id === newValue) {
                location.marker.setIcon(highlightedIcon);                
                location.marker.setAnimation(google.maps.Animation.BOUNCE);
                setTimeout(function(){ location.marker.setAnimation(null); }, 750);                 
            } 
            else { 
              location.marker.setIcon(defaultIcon);
              if(location.marker.infowindow) {          
          location.marker.infowindow.close();
        }
            }            
        });
    });

    self.selectItem = (function(data) {
        console.log(data);
        self.currentSelected(data.id);
    });
};


function initMap() {
    // Create a styles array to use with the map.
    var styles = mapStyle;

    // Constructor creates a new map - only center and zoom are required.
    map = new google.maps.Map(document.getElementById('map'), {
        center: { "lat": 18.5204303, "lng": 73.8567437 },
        zoom: 13,
        styles: styles,
        mapTypeControl: false
    });

    var largeInfowindow = new google.maps.InfoWindow({ maxWidth: 350 });

    defaultIcon = makeMarkerIcon('0091ff');
    highlightedIcon = makeMarkerIcon('FFFF24');    

    // The following group uses the location array to create an array of markers on initialize.
    for (var i = 0; i < locations.length; i++) {
        // Get the position from the location array.
        var position = locations[i].location;
        var title = locations[i].title;        

        // Create a marker per location, and put into markers array.
        var marker = new google.maps.Marker({
            position: position,                        
            title: title,
            animation: google.maps.Animation.DROP,
            icon: defaultIcon,
            id: i
        });

        locations[i].marker = marker;

        // Create an onclick event to open the large infowindow at each marker.
        marker.addListener('click', function() {
            populateInfoWindow(this, largeInfowindow);            
        });
               
    }
    showAllMarkers();
    loadFourSquareInfo();
}

function setMapOnAll(map, items) {  

    for (var i = 0; i < items.length; i++) {             
        items[i].marker.setMap(map);
    }
}

// Removes the markers from the map, but keeps them in the array.
function clearMarkers(items) {  
    setMapOnAll(null, items);
}

// Shows any markers currently in the array.
function showMarkers(items) {  
    setMapOnAll(map, items);
}

function loadFourSquareInfo() {
    var foursquareAPI = 'https://api.foursquare.com/v2/venues/';
    var fourSquareAuth = 'client_id=BZUMK1Y0YYJVVRGY4XNQQKQ0U0Z3A3ETXZGX44NVBNHGAGBA&client_secret=G30F1RG5P3SMAMCEXBTTUSWRUNUO43GF4ZHUB4P2U3ZRID1V&v=20161127';
    // queue all the jqXHR promise objects
    var q = []
    $.each(locations, function(index, location) {
        var jqXHR = $.getJSON({
                url: foursquareAPI + location.foursquareInfo.ID,
                data: fourSquareAuth,
                context: location
            })
            .done(function(data) {
                this.foursquareInfo.rating = data.response.venue.rating != null ? data.response.venue.rating : this.foursquareInfo.rating;
                this.foursquareInfo.address = data.response.venue.location.formattedAddress != null ? data.response.venue.location.formattedAddress : this.foursquareInfo.address;
            })
            .fail(function(data){
              this.foursquareInfo.address = 'data not available';
            })
        q.push(jqXHR);

    });
    // apply bindings when all the data is received     
    Promise.all(q)
        .then(() => {
            vm = new ViewModel();
            ko.applyBindings(vm);
            vm.currentSelected(0); //  make first item as default
        });
}

// This function populates the infowindow when the marker is clicked. We'll only allow
// one infowindow which will open at the marker that is clicked, and populate based
// on that markers position.
function populateInfoWindow(marker, infowindow) {

    // Check to make sure the infowindow is not already opened on this marker.    
    if (infowindow.marker != marker) {

        // Clear the infowindow content to give the streetview time to load.        
        infowindow.setContent('<div style="height:100px; width:200px"> loading... </div>');
        infowindow.marker = marker;
        marker.infowindow = infowindow;
        // Make sure the marker property is cleared if the infowindow is closed.
        infowindow.addListener('closeclick', function() {
            infowindow.marker = null;
        });


        vm.currentSelected(marker.id);
        setInfowindowContent(marker,infowindow);

        // Open the infowindow on the correct marker.
        infowindow.open(map, marker);
    }
}

function setInfowindowContent(marker,infowindow) {
    var foursquareTipsAPI = 'https://api.foursquare.com/v2/venues/' + locations[marker.id].foursquareInfo.ID + '/tips?client_id=BZUMK1Y0YYJVVRGY4XNQQKQ0U0Z3A3ETXZGX44NVBNHGAGBA&client_secret=G30F1RG5P3SMAMCEXBTTUSWRUNUO43GF4ZHUB4P2U3ZRID1V&v=20161127'
    var content = '<h4>' + marker.title + '</h4> <hr> <div>' ;

    $.getJSON(foursquareTipsAPI)
        .done(function(data) {
            $.each(data.response.tips.items, function(i, tip) {
                if (i < 2) {
                    content = content
                     + '<div class="media">' 
                     +  '<div class="media-left"> '                       
                     +  '<img class="media-object" src="' + tip.user.photo.prefix + '40x40' + tip.user.photo.suffix + '"> ' 
                     +  '</div>'
                     +  '<div class = "media-body" > '
                     +  '<h5 class = "media-heading">'+ tip.user.firstName + '</h5>' + tip.text 
                     +  '</div>'
                     + '</div>';
                }
                content = content + '</div>';
            });
            infowindow.setContent(content);
        })
        .fail(function() {
            infowindow.setContent(content + '<div>No tip found</div>');
        })
}




// This function will loop through the markers array and display them all.
function showAllMarkers() {
    var bounds = new google.maps.LatLngBounds();
    // Extend the boundaries of the map for each marker and display the marker
    for (var i = 0; i < locations.length; i++) {
        locations[i].marker.setMap(map);
        bounds.extend(locations[i].marker.position);
    }
    map.fitBounds(bounds);
}
