/**
 * Dynamite (jQuery/Zepto) plugin for dynamic content loading.
 *
 * @copyright 2015, Lauri Tunnela (http://tunne.la)
 * @license http://tunne.la/MIT.txt The MIT License
 */

;!function(window, document, $, undefined) {

	"use strict";

	var parseElement = function(html, tag) {
		var start = (new RegExp('(^|>)([\s|\r?\n|\r|\t]*)<\s*' + tag + '.*>', 'i')).exec(html),
		$element = false;

		if (start) {
			html = html.substr(start.index + start[0].length);
			var end = (new RegExp('>([\s|\r?\n|\r|\t]*)<\s*/\s*' + tag, 'i')).exec(html);
			
			if (end) {
				var div = document.createElement('div');
				div.innerHTML = html.substr(0, end.index + end[0].length - tag.length - 2);
				$element = $(div);
			}
		}
		return $element;
	},
	mergeAttributes = function($element, html, tag) {
		var attributes = (new RegExp('(^|>)([\s|\r?\n|\r|\t]*)<\s*' + tag + '(.*)>', 'i')).exec(html);

		if (attributes) {
			var innerHtml = '<div ' + attributes[3] + '></div>',
			tempEl = document.createElement('div');
			tempEl.innerHTML = innerHtml;

			$.each(tempEl.childNodes[0].attributes, function(key, item) {
				$element.attr(item.name, item.value);
			});
		}
	},
	stripScripts = function(str) {
		var pattern = /([\s|\r?\n|\r|\t]*)(<\s*script((\s+\w+(\s*=\s*(?:".*?"|'.*?'|[^'">\s]+))?)+\s*|\s*)>([\s\S]*?)<\s*\/\s*script\s*>)([\s|\r?\n|\r|\t]*)/ig,
		matches = str.match(pattern),
		scripts = '';

		for (var i = 0, l = matches.length; i < l; i++) {
			scripts += matches[i].replace(pattern, ';$6');
			str = str.replace(matches[i], '');
		}
		return str;
	},
	isDynamiteObject = function(obj) {
		return obj instanceof Dynamite;
	},
	supportHistory = typeof window.history !== 'undefined' && 
	typeof window.history.state !== 'undefined' && 
	typeof window.onpopstate !== 'undefined',
	initialized = false,
	pushed = false,
	initDynamite = function() {
		if (initialized) {
			return;
		}
		initialized = true;

		if (supportHistory) {
			$(window).off('popstate').one('popstate', function(e) {
				if (e.state && typeof e.state.response !== 'undefined') {
					pushed = false;
					parseResponse(e.state.response);
				}
			});
		}
	},
	isStylesheet = function() {
		return $(this).is('link') && $(this).attr('rel') == 'stylesheet' && $(this).attr('href');
	},
	isScript = function() {
		return $(this).is('script') && $(this).attr('src');
	},
	isInlineScript = function() {
		return $(this).is('script') && !$(this).attr('src');
	},
	isAnyScript = function() {
		return $(this).is('script');
	},
	isOther = function() {
		return !isScript.call(this) && !isStylesheet.call(this);
	},
	attributeMatchesNot = function(attr, value) {
		return $(this).attr(attr) != value;
	},
	attributeMatches = function(attr, value) {
		return $(this).attr(attr) == value;
	},
	XMLHttpFactories = [
		function () { return new XMLHttpRequest() },
		function () { return new ActiveXObject("Msxml2.XMLHTTP") },
		function () { return new ActiveXObject("Msxml3.XMLHTTP") },
		function () { return new ActiveXObject("Microsoft.XMLHTTP") }
	],
	createXMLHTTPObject = function() {
		var xmlhttp = false;

		for (var i = 0; i < XMLHttpFactories.length; i++) {
			try {
				xmlhttp = XMLHttpFactories[i]();
			}
			catch (e) {
				continue;
			}
			break;
		}
		return xmlhttp;
	},
	loadScript = function($script, where) {
		var src = $script.attr('src'),
		script = document.createElement('script');
		script.type = 'text/javascript';

		if (src) {
			var xhrObj = createXMLHTTPObject();
			xhrObj.open('GET', src, false);
			xhrObj.send('');
			script.text = xhrObj.responseText;
		} else {
			script.innerHTML = $script[0].innerHTML;
		}
		where.appendChild(script);
	},
	parseResponse = function(response) {
		var $head = parseElement(response, 'head'),
		$body = parseElement(response, 'body'),
		$headStylesheets = $('link', $head).filter(isStylesheet),
		$headScripts = $('script', $head).filter(isScript),
		$headOthers = $('*', $head).filter(isOther),
		$bodyScripts = $('script', $body).filter(isAnyScript),
		$stylesheets = $(),
		$scripts = $();

		$('head *').filter(isOther).remove();

		$('head link').filter(isStylesheet).filter(function() {
			var href = $(this).attr('href'),
			$found = $headStylesheets.filter(function() {
				return attributeMatches.call(this, 'href', href);
			}),
			result = $found.length === 0;

			$headStylesheets = $headStylesheets.filter(function() {
				return attributeMatchesNot.call(this, 'href', href);
			});
			return result;
		})
		.remove();

		$('head script').remove();
		$('body script').remove();

		if ($headStylesheets.length) {
			$('head').append($headStylesheets);
		}
		if ($headScripts.length) {
			$('head').append($headScripts);
		}
		if ($headOthers.length) {
			$('head').append($headOthers);
		}
		$('body').html(stripScripts($body.html()));
		mergeAttributes($('body'), response, 'body');

		if ($bodyScripts.length) {
			for (var i = 0, l = $bodyScripts.length; i < l; i++) {
				loadScript($($bodyScripts[i]), document.getElementsByTagName('body')[0]);
			}
		}
		$(window).trigger('load');
	},
	loadUrl = function(url) {
		$.ajax({
			async: true,
			url: url,
			dataType: 'html',
			success: function(response) {
				parseResponse(response);

				var a = document.createElement('a'),
				a2 = document.createElement('a');
				a.href = url;
				a2.href = window.location.href;

				if (supportHistory && a.href !== a2.href) {
					pushed = true;
					window.history.pushState({ response: response }, '', url);
				}
			}
		});
	};

	function Dynamite(element, options) {
		var $element = $(element),
		element = $element.get(0),
		defaults = {
		},
		options = $.extend({}, defaults, options);

		this.options = options;

		initDynamite();

		$element.one('click', function(e) {
			var href = $(this).attr('href');
			
			if (href && this.host !== undefined && this.host === location.host) {
				e.preventDefault();
				loadUrl(href);
			}
		});
	}

	$.fn.dynamite = function(options) {
		return this.each(function() {
			var dynamite = $(this).data('dynamite');

			if (!isDynamiteObject(dynamite)) {
				$(this).data('dynamite', new Dynamite(this, options));
			}
		});
	};

	$(function() {
		if (!$('[data-dynamite-detect=false]').first().length) {
			$('[data-dynamite]').dynamite();
		}
	});

}(window, document, window.Zepto || window.jQuery);