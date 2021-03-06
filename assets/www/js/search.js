window.search = function() {
	function performSearch(term, isSuggestion) {
		if($('#search').hasClass('inProgress')) {
			network.stopCurrentRequest();
			$('#search').removeClass('inProgress');
			return;
		}
		if (network.isConnected()) {
			if (term == '') {
				chrome.showContent();
				return;
			}

			chrome.showSpinner();
			$('#search').addClass('inProgress');

			if(!isSuggestion) {
				var url = app.urlForTitle(term);
				app.navigateToPage(url);
				return;
			}
			getSearchResults( term );
		} else {
			chrome.showNoConnectionMessage();
			chrome.showContent();
		}
	}

	function getDidYouMeanResults(results) {
		// perform did you mean search
		console.log( "Performing 'did you mean' search for", results[0] );
		var requestUrl = app.baseURL + "/w/api.php";        
		$.ajax({
   			type: 'GET',
			url: requestUrl,
			data: {
				action: 'query',
       			list: 'search',                
				srsearch: results[0],
       			srinfo: 'suggestion',
				format: 'json'
       		},
       		success: function(data) {
				var suggestion_results = JSON.parse( data );
				var suggestion = getSuggestionFromSuggestionResults( suggestion_results );
				if ( suggestion ) {
					getSearchResults( suggestion, 'true' );
				}
			}
		});
	}

	function getSuggestionFromSuggestionResults( suggestion_results ) {
		console.log( "Suggestion results", suggestion_results );
		if ( typeof suggestion_results.query.searchinfo != 'undefined' ) {
			var suggestion = suggestion_results.query.searchinfo.suggestion;
			console.log( 'Suggestion found:', suggestion );
			return suggestion;
		} else {
			return false;
		}
	}
	
	function getSearchResults(term, didyoumean) {
		console.log( 'Getting search results for term:', term );
		var requestUrl = app.baseURL + "/w/api.php";
		$.ajax({
			type: 'GET',
			url: requestUrl,
			data: {
				action: 'opensearch',
				search: term,
				format: 'json'
			},
			success: function(data) {
				var results = JSON.parse( data );
				if ( results[1].length === 0 ) { 
					console.log( "No results for", term );
					getDidYouMeanResults( results );
				} else {
					if ( typeof didyoumean == 'undefined' ) {
						didyoumean = false;
					}
					console.log( 'Did you mean?', didyoumean );
					renderResults(results, didyoumean);
				}			
			}
		});
	}

	function onSearchResultClicked() {
		var parent = $(this).parents(".listItemContainer");
		var url = parent.attr("data-page-url");
		app.navigateToPage(url);
	}

	function onCloseSearchResults() {
		chrome.hideOverlays();
	}

	function renderResults(results, didyoumean) {
		var template = templates.getTemplate('search-results-template');
		if (results.length > 0) {

			var searchParam = results[0];
			console.log( "searchParam", searchParam );
			var searchResults = results[1].map(function(title) {
				return {
					key: app.urlForTitle(title),
					title: title
				};
			});
			if ( didyoumean ) {
				var didyoumean_link = {
					key: app.urlForTitle(results[0]),
					title: results[0]
				};
				$("#resultList").html(template.render({'pages': searchResults, 'didyoumean': didyoumean_link}));
			} else {
				$("#resultList").html(template.render({'pages': searchResults}));
			}
			$("#resultList .searchItem").click(onSearchResultClicked);
		}
		$(".closeSearch").click(onCloseSearchResults);
		// Replace icon of savd pages in search suggestions
		var savedPagesDB = new Lawnchair({name:"savedPagesDB"}, function() {
			$("#resultList .listItemContainer").each(function() {
				var container = this;
				var url = $(this).attr('data-page-url');
				savedPagesDB.exists(url, function(exists) {
					if(exists) {
						$(container).find(".iconSearchResult").removeClass("iconSearchResult").addClass("iconSavedPage");
					}
				});
			});
		});

		$('#search').removeClass('inProgress');
		chrome.hideSpinner();
		chrome.hideOverlays();

		if(!chrome.isTwoColumnView()) {
			$("#content").hide(); // Not chrome.hideContent() since we want the header
		}

		chrome.doFocusHack();
		$('#searchresults').localize().show();
		chrome.doScrollHack('#searchresults .scroller');
	}

	return {
		performSearch: performSearch
	};
}();

