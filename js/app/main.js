var map;

//knockout view-model
var ViewModel = function() {
    var self = this;
    self.currentFilter = ko.observable('');
    self.filteredLocations = ko.computed(function() {
        return locations.filter(function(value) {
            return value.title.toLowerCase().includes(self.currentFilter().toLowerCase());
        });
    });

    self.filteredLocations.subscribe(function(newValue) {

        showMarkers(newValue);
    });

    self.currentSelected = ko.observable(0);
    self.currentSelected.subscribe(function(newValue) {
        $.each(locations, function(i, location) {
            if (location.id === newValue) {
                location.marker.setIcon(highlightedIcon);
                google.maps.event.trigger(location.marker, 'click');
                location.marker.setAnimation(google.maps.Animation.BOUNCE);
                setTimeout(function() { location.marker.setAnimation(null); }, 750);
            } else {
                location.marker.setIcon(defaultIcon);
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



    largeInfowindow = new google.maps.InfoWindow();

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

        google.maps.event.addListener(largeInfowindow, 'domready', function() {
            // Reference to the DIV which receives the contents of the infowindow using jQuery
            var iwOuter = $('.gm-style-iw');
            /* The DIV we want to change is above the .gm-style-iw DIV.
             * So, we use jQuery and create a iwBackground variable,
             * and took advantage of the existing reference to .gm-style-iw for the previous DIV with .prev().
             */
            iwOuter.css({ top: '40px' });
            var iwBackground = iwOuter.prev();
            // Remove the background shadow DIV
            iwBackground.children(':nth-child(2)').css({ 'display': 'none' });
            // Remove the white background DIV
            iwBackground.children(':nth-child(4)').css({ 'display': 'none' });
            var iwCloseBtn = iwOuter.next();
            // Apply the desired effect to the close button
            iwCloseBtn.css({
                opacity: '0.5', // by default the close button has an opacity of 0.7
                right: '40px',
                top: '41px', // button repositioning
                'border-radius': '2px' // circular effect          
            });

            iwCloseBtn.mouseover(function() {
                $(this).css({ opacity: '1' });
            });

        });

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
    //setMapOnAll(null, items);
    for (var i = 0; i < items.length; i++) {
        items[i].marker.setVisible(false);
    }
}

// Shows any markers currently in the array.
function showMarkers(items) {
    $.each(locations, function(i, location) {
        if ($.inArray(location, items) !== -1) {
            location.marker.setVisible(true);
        } else {
            location.marker.setVisible(false);
        }
    });
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
            .fail(function(data) {                
                this.foursquareInfo.address = 'Oops! Could not connect Foursquare© API';
            })
        q.push(jqXHR);
    });
    // apply bindings when all the data is received     
    Promise.all(q)
        .then(() => {
                vm = new ViewModel();
                ko.applyBindings(vm);
                vm.currentSelected(0); //  make first item as default
                $('#sidebar-spinner').toggleClass('hidden');
            },
            () => {
                vm = new ViewModel();
                ko.applyBindings(vm);
                vm.currentSelected(0); //  make first item as default
                $('#sidebar').html('<div class="bg-danger"> <span class="fa fa-exclamation-circle"></span> Oops! Could not connect Foursquare© API  </div> </div>');            
            });
}


// This function populates the infowindow when the marker is clicked. We'll only allow
// one infowindow which will open at the marker that is clicked, and populate based
// on that markers position.
function populateInfoWindow(marker, infowindow) {    
    // Check to make sure the infowindow is not already opened on this marker.    
    if (infowindow.marker != marker) {    
        // Clear the infowindow content to give the streetview time to load.  
          var content = '<div id="ifw">'
                            + '<div class="panel panel-primary">'
                                +'<div class="panel-heading">' 
                                    +'<div>'
                                        +'<h4>'
                                        + marker.title                                                       
                                        +'</h4>'        
                                        +'<div class="media">'     
                                            +'<div class="media-object media-left media-middle">'
                                                + setCashIcon(locations[marker.id].currentStatus.cash)  
                                            +'</div>'                                        
                                            +'<div class="media-body">'
                                                +'<small style="display: block"> '+ (locations[marker.id].currentStatus.cash ? 'Cash available': 'No cash') +' </small> </a>' // todo
                                                +'<small>'+ moment(locations[marker.id].currentStatus.updateTime).fromNow()+ '</small>'
                                            +'</div>'                                        
                                        +'</div>'                                        
                                    +'</div>'
                                +'</div>' 
                                +'<div id="ifw-body" class="panel-body">'
                                +'<div id="ifw-tips">'                                 
                                  +'<div id="ifw-spinner">' 
                                    +'<i class="fa fa-spinner fa-pulse fa-3x fa-fw"></i>'
                                  +'</div>' 
                                    +'</div>' 
                                  +'<div class="foursquareThanks text-info">' 
                                    +'<small> <em> Powered by Foursquare© </em></small>'
                                  +'</div>'                                   
                                +'</div>' 
                            +'</div>' 
                        +'</div>' ;                        
        infowindow.setContent(content);
        infowindow.marker = marker;        
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

function setCashIcon(hasCash)
{
    var cashIcon = '<span class="fa-stack fa-lg">'
            +'<i class="fa fa-circle fa-stack-2x text-success"></i>'
            +'<i class="fa fa-money fa-stack-1x"></i>'
        +'</span>';
        var noCashIcon = 
        '<span class="fa-stack fa-lg">'
            +'<i class="fa fa-money fa-stack-1x"></i>'
            +'<i class="fa fa-ban fa-stack-2x text-danger"></i>'
        +'</span>';

        return hasCash?cashIcon:noCashIcon;
}

function setInfowindowContent(marker,infowindow) {
    var location = locations[marker.id];
    var foursquareTipsAPI = 'https://api.foursquare.com/v2/venues/' + location.foursquareInfo.ID + '/tips?client_id=BZUMK1Y0YYJVVRGY4XNQQKQ0U0Z3A3ETXZGX44NVBNHGAGBA&client_secret=G30F1RG5P3SMAMCEXBTTUSWRUNUO43GF4ZHUB4P2U3ZRID1V&v=20161127'
 
    $.getJSON(foursquareTipsAPI)
        .done(function(data) {
                //content = content + '<div class="panel-body">';
                var tipsHTML = '';
            $.each(data.response.tips.items, function(i, tip) {                
                if (i < 2) {
                    tipsHTML += 
                       '<div class="media">' 
                         +  '<div class="media-left"> '                       
                            +  '<img class="media-object" src="' + tip.user.photo.prefix + '40x40' + tip.user.photo.suffix + '"> ' 
                         +  '</div>'
                         +  '<div class = "media-body" > '
                            +  '<h5 class = "media-heading">'+ tip.user.firstName + '</h5>' + tip.text 
                         +  '</div>'
                     + '</div>';
                }                
            });
            $('#ifw-tips').html('<div class="tips">'+tipsHTML+'</div>');
        })
        .fail(function() {
            $('#ifw-body').html('<div class="bg-danger"> <span class="fa fa-exclamation-circle"></span>  Oops! Could not connect Foursquare© API  </div> </div>');            
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

$('#menu-toggle').click(function(e) {
    e.preventDefault();
    $('aside').toggleClass('hidden');
    $('main').toggleClass('col-md-12 col-xs-12 col-lg-12 col-lg-9 col-xs-8 col-md-8');
    console.log('togleed');
    mapRefresh();
});

$(window).resize(mapRefresh()).resize();

function mapRefresh() {
    var h = $(window).height(),
        offsetTop = 60;    
    $('#map').css('height', (h - offsetTop));
    $('#sidebar').css('height', (h - offsetTop));

    if (typeof google !== 'undefined') {
        google.maps.event.trigger(map, 'resize');
    }
}

function mapError() {
    $('#map').html('<p class="bg-danger"> <span class="fa fa-exclamation-circle"></span> Oops! Could not connect with Google maps.</p>');
}
