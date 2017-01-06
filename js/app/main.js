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

    self.title = ko.observable('');
    self.cashIcon = ko.observable('');
    self.cashStatus = ko.observable('');
    self.updateTime = ko.observable('');
    self.tips = ko.observableArray([]);

    self.filteredLocations.subscribe(function(newValue) {
        showMarkers(newValue);
    });

    self.currentSelected = ko.observable();
    self.currentSelected.subscribe(function(newValue) {
        locations.forEach((location, i) => {
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

    self.hideIFWSpinner = ko.observable(false);
    self.selectItem = (function(data) {
        self.currentSelected(data.id);
    });
};

var vm = new ViewModel();

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
    locations.forEach((location, i) => {
        // Get the position from the location array.
        var position = location.location;
        var title = location.title;

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
            //Infowindow layout design is placed here since its done dynamically on domReady
            // Reference to the DIV which receives the contents of the infowindow using jQuery
            var iwOuter = $('.gm-style-iw');
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
    });

    largeInfowindow.setContent($('#ifw-template').html());
    largeInfowindow.open(map, locations[0].marker);
    showAllMarkers();
    loadFourSquareInfo();
}

// Shows any markers currently in the array.
function showMarkers(items) {
    locations.forEach((location, i) => {
        if ($.inArray(location, items) !== -1) {
            location.marker.setVisible(true);
        } else {
            location.marker.setVisible(false);
            if (location.id === vm.currentSelected())
                largeInfowindow.close();
        }
    });
}

function setIFWDetails(location) {
    vm.title(location.title);
    vm.cashIcon(setCashIcon(location.currentStatus.cash));
    vm.cashStatus(location.currentStatus.cash ? 'Cash available' : 'No cash');
    vm.updateTime(moment(location.currentStatus.updateTime).fromNow());
    setTipsContent(location);
}

function loadFourSquareInfo() {
    var foursquareAPI = 'https://api.foursquare.com/v2/venues/';
    var fourSquareAuth = 'client_id=BZUMK1Y0YYJVVRGY4XNQQKQ0U0Z3A3ETXZGX44NVBNHGAGBA&client_secret=G30F1RG5P3SMAMCEXBTTUSWRUNUO43GF4ZHUB4P2U3ZRID1V&v=20161127';
    // queue all the jqXHR promise objects
    var q = [];
    locations.forEach((location, index) => {
        var jqXHR = $.getJSON({
                url: foursquareAPI + location.foursquareInfo.ID,
                data: fourSquareAuth,
                context: location
            })
            .done(function(data) {
                this.foursquareInfo.rating = data.response.venue.rating !== null ? data.response.venue.rating : this.foursquareInfo.rating;
                this.foursquareInfo.address = data.response.venue.location.formattedAddress !== null ? data.response.venue.location.formattedAddress : this.foursquareInfo.address;
            })
            .fail(function(data) {
                this.foursquareInfo.address = 'Oops! Could not connect Foursquare© API';
            });
        q.push(jqXHR);
    });
    Promise.all(q)
        .then(() => {
                ko.applyBindings(vm);
                $('#sidebar-spinner').toggleClass('hidden');
                vm.currentSelected(0); //  make first item as default
            },
            () => {
                ko.applyBindings(vm);
                vm.currentSelected(0); //  make first item as default
                $('#sidebar').html('<div class="bg-danger"> <span class="fa fa-exclamation-circle"></span> Oops! Could not connect Foursquare© API  </div> </div>');
            });
}


// This function populates the infowindow when the marker or listitem is clicked.
function populateInfoWindow(marker, infowindow) {
    // check if the marker is current selecte if note loop through current selected
    if (vm.currentSelected() == marker.id) {
        // Check to make sure the infowindow is not already opened on this marker.        
        if (infowindow.marker != marker) {
            infowindow.marker = marker;
            // Make sure the marker property is cleared if the infowindow is closed.
            infowindow.addListener('closeclick', function() {
                infowindow.marker = null;
            });
            infowindow.open(map, marker);
            setIFWDetails(locations[marker.id]);
        } else {
            infowindow.open(map, marker);
        }
    } else { vm.currentSelected(marker.id); }
}

function setCashIcon(hasCash) {
    var cashIcon = '<span class="fa-stack fa-lg">' + '<i class="fa fa-circle fa-stack-2x text-success"></i>' + '<i class="fa fa-money fa-stack-1x"></i>' + '</span>';
    var noCashIcon =
        '<span class="fa-stack fa-lg">' + '<i class="fa fa-money fa-stack-1x"></i>' + '<i class="fa fa-ban fa-stack-2x text-danger"></i>' + '</span>';

    return hasCash ? cashIcon : noCashIcon;
}

function setTipsContent(location) {
    var foursquareTipsAPI = 'https://api.foursquare.com/v2/venues/' + location.foursquareInfo.ID + '/tips?client_id=BZUMK1Y0YYJVVRGY4XNQQKQ0U0Z3A3ETXZGX44NVBNHGAGBA&client_secret=G30F1RG5P3SMAMCEXBTTUSWRUNUO43GF4ZHUB4P2U3ZRID1V&v=20161127';
    vm.tips.removeAll();
    $.getJSON(foursquareTipsAPI)
        .done(function(data) {
            data.response.tips.items.forEach((tip, i) => {
                if (i < 3) {
                    vm.tips.push({
                        userName: tip.user.firstName,
                        tipText: tip.text,
                        userImage: tip.user.photo.prefix + '40x40' + tip.user.photo.suffix
                    });
                }
            });
            $('#ifw-Error').addClass('hidden');
        })
        .fail(function() {
            $('#ifw-Error').removeClass('hidden');
        })
        .always(function() {
            vm.hideIFWSpinner(true);
        });
}

// This function will loop through the markers array and display them all.
function showAllMarkers() {
    var bounds = new google.maps.LatLngBounds();
    // Extend the boundaries of the map for each marker and display the marker
    locations.forEach((location, i) => {
        location.marker.setMap(map);
        bounds.extend(location.marker.position);
    });
    map.fitBounds(bounds);
}

$('#menu-toggle').click(function(e) {
    e.preventDefault();
    $('aside').toggleClass('hidden');
    $('main').toggleClass('col-md-12 col-xs-12 col-lg-12 col-lg-9 col-xs-8 col-md-8');
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
    $('#sidebar').html('<div class="bg-danger container-fluid "> <span class="fa fa-exclamation-circle"></span> Oops! Could not connect with Google maps.</div>');
}
