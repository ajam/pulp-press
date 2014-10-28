(function(){

	var $els = {
		pagesContainer: $('.main-container-el[data-which="pages"]'),
		endnotesContainer: $('.main-container-el[data-which="endnotes"]')
	};

	var templates = {
		pageContainerFactory: _.template( $('#page-container-templ').html() ),
		hotspotFactory: _.template( $('#hotspot-templ').html() ),
		note: $('#note-templ').html(),
		text: $('#text-templ').html()
	};

	var states = {
		createHotspotDragging: false
	};

	var data = {
		info: {
			endnotes: [],
			pages: []
		},
		primeForDownload: function(){
			data.info.endnotes = notes.record($('#endnotes-container'), 'objects');
			data.info.pages = data.info.pages.sort(helpers.sortByNumber);
			var data_url = "text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data.info));
			$('#download-button').attr('href','data:' + data_url);
		},
		load: function(evt){
			var files = evt.target.files; // FileList object
			// Loop through the FileList and render image files as thumbnails.
			for (var i = 0, f; f = files[i]; i++) {
				// Only process data files.
				if (!f.type.match('application/json')) {
					continue;
				}
				var reader = new FileReader();
				// Closure to capture the file information.
				reader.onload = (function(theFile) {
					return function(e) {

						var json = JSON.parse(e.target.result);
						layout.fromData.endnotes(json.endnotes);
						data.info.pages = json.pages;
						data.primeForDownload();
					};
				})(f);
				// Read in the image file as a data URL.
				reader.readAsText(f);
			}
		}
	};

	var layout = {
		switchTabs: function(which){
			$('#tabs li.active').removeClass('active');
			$('#tabs li[data-which="'+which+'"]').addClass('active');
			$('.main-container-el.active').removeClass('active');
			$('.main-container-el[data-which="'+which+'"]').addClass('active');
		},
		fromData: {
			endnotes: function(endnotes){
				endnotes.forEach(function(endnote){
					var $template = $(templates.note),
							page_panel = endnote.page_panel,
							text = endnote.text,
							url = endnote.url;

					$template.find('input[name="page-panel"]').val(page_panel);
					$template.find('input[name="text"]').val(text);
					$template.find('input[name="url"]').val(url);
					$els.endnotesContainer.find('ul').append($template);

				});
			},
			pageText: function(fName){
				var page_data = {
							fileName: fName,
							script_text: '',
							page_text: []
						},
						page_number = helpers.templateFormatters.extractPageNumber(fName),
						existing_page_data = _.findWhere(data.info.pages, {number: page_number}),
						existing_data_we_want;

				// You could extend the whole object but that will give you unnecessary data
				// So just grab the script and page text
				if (existing_page_data){
					existing_data_we_want = {
						script_text: existing_page_data.script_text,
						page_text: existing_page_data.page_text
					};
					_.extend(page_data, existing_data_we_want);
				}
				return page_data;
			}
		}
	};

	var helpers = {
		countHotspots: function($container, $hotspot, dir){
			var hotspot_count = +$container.attr('data-hotspots');
			if (dir == 'add') {
				hotspot_count++;
			} else {
				hotspot_count--;
				helpers.renumberHotspots($container, $hotspot.attr('data-number'));
			}
			$container.attr('data-hotspots', hotspot_count);
		},
		renumberHotspots: function($container, destroyed_number){
			var $hotspots_higher_than_destroyed = $container.find('.hotspot').filter(function(){
				return +$(this).attr('data-number') > destroyed_number;
			});
			$hotspots_higher_than_destroyed.each(function(){
				var $hotspot = $(this);
				var hotspot_number = +$(this).attr('data-number');
				hotspot_number--;
				$hotspot.attr('data-number', hotspot_number).find('.hotspot-number').html(hotspot_number);
			})
		},
		templateFormatters: {
			extractPageNumber: function(fileName){
				return +fileName.split('-')[1].split('\.')[0]; // `page-1.png` => `1`
			}
		},
		cssifyValues: function(val){
			return (val*100).toFixed(2);
		},
		sortByNumber: function(a,b){
			return a.number - b.number;
		}
	};

	var hotspots = {
		bake: function(e){
			var $pageContainer = $(this);
			states.createHotspotDragging = true;
			// Increment this page's hotspot number by one
			helpers.countHotspots($pageContainer, null, 'add');
			// Grab it
			var hotspot_number = $pageContainer.attr('data-hotspots');
			// Make this markup with the new number
			var hotspot_markup = templates.hotspotFactory({hotspot_number: hotspot_number});
			var $new_hotspot = $(hotspot_markup).appendTo( $pageContainer.find('.hotspots') );

			$new_hotspot.css({
				top: e.pageY - $(this).offset().top,
				left: e.pageX - $(this).offset().left
			});

			$new_hotspot.draggable({
				containment: $pageContainer
			}).resizable();

		},
		sizeByDrag: {
			init: function(e){
				var starting_x,
						starting_y,
						$hotspot;

				if (states.createHotspotDragging){
					$hotspot = $('.hotspot.create-dragging');
					starting_x = $hotspot.offset().left;
					starting_y = $hotspot.offset().top;

					$hotspot.css({
						width: e.pageX - starting_x,
						height: e.pageY - starting_y,
					});

				}
			},
			end: function(e){
		  	states.createHotspotDragging = false;
		  	$('.hotspot.create-dragging').removeClass('create-dragging');
			}
		},
		destroy: function(e){
			// Kill this panel
			var $hotspot = $(this).parents('.hotspot')
			helpers.countHotspots($(this).parents('.page-container'), $hotspot, 'remove');
			$hotspot.remove();
		}
	};

	var notes = {
		add: function(mode){
			var $this = $(this),
					mode = $this.attr('data-mode'),
					$notes_container = $this.siblings('.notes-list-container');
					note_markup = templates[mode];

			$notes_container.append(note_markup);
		},
		destroy: function(){
			$(this).parents('.note-group').remove();
		},
		record: function($cntr, mode){
			var notes = [];
			$cntr.find('.note-group').each(function(i){
				var $this = $(this);
				var page_panel  = $this.find('input[name="page-panel"]').val(),
						text = $this.find('input[name="text"]').val(),
						url  = $this.find('input[name="url"]').val(),
						obj = {};
				// Don't add if text is empty
				if (text) {
					if (mode == 'objects'){
						obj.number = i + 1;
						obj.page_panel = page_panel;
						obj.text = text;
						if (url) obj.url = url;
					} else if (mode == 'list'){
						obj = text;
					}
					notes.push(obj);
				}
			});
			return notes;
		}
	};

	var pageActions = {
		save: function(){
			$(this).prop('disabled', true);
			var page_number = +$(this).parents('.page-container').attr('data-page-number');
			var page = pageActions.record.all(page_number);
			// This could more nicely be accomplished by making this array a Backbone collection, which would handle merging of properties. But for now this is fine.
			var page_already_in_data = _.findWhere(data.info.pages, {number: page.number});
			if (page_already_in_data){
				// Remove it from the data
				data.info.pages = _.without(data.info.pages, page_already_in_data);
			} 
			data.info.pages.push(page);
			// Call the destroy within the context of the jQuery object
			pageActions.destroy.call(this, true);
			data.primeForDownload();
		},
		record: {
			all: function(pageNumber){
				var pageData = {};
				pageData.number = pageNumber;
				var $pageContainer = $('.page-container[data-page-number="' + pageNumber + '"]')
				pageData.hotspots = this.hotspots($pageContainer) || [];
				pageData.script_text = this.text($pageContainer) || '';
				pageData.page_text = notes.record($pageContainer, 'list') || [];
				return pageData;
			},
			hotspots: function($cntnr){
				var $panelImg = $cntnr.find('.panel-img'),
						panel_width = $panelImg.width(),
						panel_height = $panelImg.height();
				var hotspots = [];
				$cntnr.find('.hotspot').each(function(){
					var $hotspot = $(this);
					var top    = helpers.cssifyValues($hotspot.position().top / panel_height),
							left   = helpers.cssifyValues($hotspot.position().left / panel_width),
							height = helpers.cssifyValues($hotspot.height() / panel_height),
							width  = helpers.cssifyValues($hotspot.width() / panel_width);

					var hotspot = 'top:'+top+'%;left:'+left+'%;width:'+width+'%;height:'+height+'%;'
					hotspots.push(hotspot);
				});
				return hotspots;
			},
			text: function($cntnr){
				return $cntnr.find('.alt-text textarea').val();
			}
		},
		destroy: function(saved){
			$(this).parents('.page-container').remove();
			var banner_msg = 'Page deleted.'
			if (saved) banner_msg = 'Page saved!';
			// helpers.showBanner(banner_msg);
		},
		addPages: {
			load: function(evt){
				var files = evt.target.files; // FileList object
				// Loop through the FileList and render image files as thumbnails.
				for (var i = 0, f; f = files[i]; i++) {
					// Only process image files.
					if (!f.type.match('image.*')) {
						continue;
					}
					var reader = new FileReader();
					// Closure to capture the file information.
					reader.onload = (function(theFile) {
						return function(e) {
							// Render thumbnail.
							// Append to the thumbnail
							// pageActions.addPages.append(theFile.name, e.target.result)
							// Append to the thumbnail drawer
							pageActions.addPages.append(theFile.name, e.target.result, $els.pagesContainer)
						};
					})(f);
					// Read in the image file as a data URL.
					reader.readAsDataURL(f);
				}
			},
			append: function(fileName, imageData, target){
				// Bake the markup from the template, adding data if it exists
				// var page_data = { fileName: fileName };
				var page_data = layout.fromData.pageText(fileName);
				// Add our helpers
				_.extend(page_data, helpers.templateFormatters);
				var page_container = templates.pageContainerFactory( page_data );
				// Hide things on load so we don't get a flash as the image is moved towards the center
				var $pageContainer = $( page_container ).css('visibility','hidden');
				// First add the image container to the dom
				target.append($pageContainer);
				// Next load the image data and append it to the image container
				$('<img class="panel-img" src="'+imageData+'"/>').load(function(){

					var $el = $(this);
					$el.prependTo( $pageContainer );
					// This measurement will occur after the image has been appended usually
					// But will ensure we're measuring the image after the dom has actually measured it
					var loaded_img_width = $el.width(),
							loaded_img_height = $el.height();

					$pageContainer
						.width(loaded_img_width)
						.height(loaded_img_height)
						.css('visibility','visible');

					// If we've preloaded data and this page is in that data, load hotspots
					var page_number = +fileName.split('.')[0].split('-')[1], // `"page-1.png"` --> `1`
							existing_page_data = _.findWhere(data.info.pages, {number: page_number}),
							hotspots;

					if (existing_page_data){
						hotspots = existing_page_data.hotspots;
						hotspots.forEach(function(hotspot, index){

							var hotspot_markup = templates.hotspotFactory({hotspot_number: (index+1) });
							var $new_hotspot   = $(hotspot_markup).appendTo( $pageContainer.find('.hotspots') );

							// Convert this list of css styles to json
							$new_hotspot.attr('style', hotspot);
							// These don't need this gate because they're being sized programatically
							$new_hotspot.removeClass('create-dragging');

							$new_hotspot.draggable({
								containment: $pageContainer
							}).resizable();

						});
						$pageContainer.attr('data-hotspots', hotspots.length);
						
					}

				})

				var left_offset = this.positionElement($pageContainer.find('.page-info'), 'left');
				// this.positionElement($pageContainer.find('.page-actions'), 'right');
				$pageContainer.find('.page-info textarea').css('max-width',(left_offset - 20) + 'px');

			},
			positionElement: function($el, side){
				// Offset the page name to the left
				var el_width = $el.outerWidth();
				$el.css(side, -el_width + 'px');
				return el_width;
			}
		}
	};

	var listeners = {
		general: function(){
			// Listen for file uploading
		  document.getElementById('existing-data').addEventListener('change', data.load, false);
		  document.getElementById('images').addEventListener('change', pageActions.addPages.load, false);
		  $els.pagesContainer.on('mousedown', '.page-furniture', listeners.killPropagation);

		  $('#tabs li').on('click', function(){
		  	var $this = $(this),
		  			which = $this.attr('data-which'),
		  			isActive = $this.hasClass('active');

		  	if (!isActive){
		  		layout.switchTabs(which);
		  	}
		  });

		},
		hotspotAdding: function(){
		  // Listen for click events on each page-container
		  // Add the listener to the parent object, listening to its children
		  $els.pagesContainer.on('mousedown', '.page-container', hotspots.bake);
		  // Listen to the drag event
		  $els.pagesContainer.on('mousemove', '.page-container', hotspots.sizeByDrag.init);
		  // Stop create hotspot drag state
		  $els.pagesContainer.on('mouseup', '.page-container', hotspots.sizeByDrag.end);
		  // Don't add a new hotspot if we're just dragging a hotspot
		  $els.pagesContainer.on('mousedown', '.hotspot', listeners.killPropagation);
		  $els.pagesContainer.on('mousedown', '.hotspot .destroy', hotspots.destroy);
		},
		notes: function(){
			$('#page-wrapper').on('click', '.add', notes.add);
			$('#page-wrapper').on('click', '.destroy', notes.destroy);
			$('.internal-link[data-which="endnotes"]').on('click',  function(){
				layout.switchTabs('endnotes');
			});
			$els.endnotesContainer.on('keyup', 'input[type="text"]', data.primeForDownload);
		},
		pageActions: function(){
			$els.pagesContainer.on('click', '.page-actions .save-page button', pageActions.save);
			$els.pagesContainer.on('click', '.page-actions .destroy button', pageActions.destroy);
		},
		killPropagation: function(e){
	  	e.stopPropagation();
		}
	};

	var init = {
		go: function(){
			listeners.general();
			listeners.hotspotAdding();
			listeners.notes();
			listeners.pageActions();
		}
	};

	init.go();


}).call(this);