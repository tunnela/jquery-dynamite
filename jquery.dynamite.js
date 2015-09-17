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
	instanceCount = 1,
	instances = {},
	linkId = 0,
	links = {},
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
					parseResponse.call(links[e.state.id], e.state.response);
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
	parseResponse = function(response) {
		var $head = parseElement(response, 'head'),
		$body = parseElement(response, 'body'),
		$headStylesheets = $('link', $head).filter(isStylesheet),
		$headScripts = $('script', $head).filter(isScript),
		$headOthers = $('*', $head).filter(isOther),
		$bodyScripts = $('script', $body).filter(isAnyScript),
		$stylesheets = $(),
		$scripts = $(),
		options = {
			bodyHTML: stripScripts($body.html()),
			headStylesheets: function() {
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

				if ($headStylesheets.length) {
					$('head').append($headStylesheets);
				}
			},
			headScripts: function() {
				$('head script').remove();

				if ($headScripts.length) {
					$('head').append($headScripts);
				}
			},
			headOthers: function() {
				$('head *').filter(isOther).remove();

				if ($headOthers.length) {
					$('head').append($headOthers);
				}
			},
			bodyAttributes: function() {
				mergeAttributes($('body'), response, 'body');
			},
			bodyScripts: function() {
				$('body script').remove();

				if ($bodyScripts.length) {
					var pendingScripts = [];
					var $bodyScript;

					var loadScripts = function(exec) {
						if ($bodyScripts.length <= 0) {
							exec();
							return;
						}
						var script;
						var scriptEl = $bodyScripts.get(0);
						var inline = typeof scriptEl.src === 'undefined' || !scriptEl.src;

						$bodyScripts = $bodyScripts.slice(1);

						script = document.createElement('script');
						script.async = false;

						if (inline) {
							script.innerHTML = scriptEl.innerHTML;
							document.body.appendChild(script);
							loadScripts(exec);
						} else {
							script.onload = function() {
								loadScripts(exec);
							};
							script.src = scriptEl.src;
							document.body.appendChild(script);
						}
					};

					loadScripts(function() {
						$(window).trigger('load');
					});
				}
			},
			replaceBody: function() {
				$('body').html(this.bodyHTML);
				this.bodyAttributes();
			},
			renderHead: function() {
				this.headOthers();
				this.headStylesheets();
				this.headScripts();
			},
			renderBody: function() {
				this.replaceBody();
				this.bodyScripts();
			},
			render: function() {
				this.renderHead();
				this.renderBody();
			}
		};

		$(this).one('pageReady', function(e, opts) {
			opts.render();
		})
		.trigger('pageReady', [options]);
	},
	loadUrl = function(url) {
		var that = this;

		$.ajax({
			async: true,
			url: url,
			success: function(response) {
				parseResponse.call(that, response);

				var a = document.createElement('a'),
				a2 = document.createElement('a');
				a.href = url;
				a2.href = window.location.href;

				if (supportHistory && a.href !== a2.href) {
					pushed = true;

					if (!$(that).data('dynamite-id')) {
						$(that).data('dynamite-id', linkId);
						links[linkId] = that;
					} else {
						linkId = $(that).data('dynamite-id');
					}
					window.history.pushState({ response: response, id: linkId }, '', url);
				}
			}
		});
	},
	asyncSupport = 'async' in document.createElement('script'),
	onClick = function(e) {
		var href = $(this).attr('href');

		var a = document.createElement('a');
		a.href = window.location.href;

		if (href && this.host === a.host) {
			e.preventDefault();
			loadUrl.call(this, href);
			return false;
		}
	};

	function Dynamite(element, options) {
		var $element = $(element),
		element = $element.get(0),
		defaults = {},
		options = $.extend({}, defaults, options);

		this.options = options;
		this.element = function() {
			return element;
		};

		initDynamite();

		$element.on('click', onClick);
	}

	$.fn.dynamite = function(options) {
		var apis = [],
		elements = this.each(function() {
			if (!asyncSupport) {
				return;
			}
			var id = $(this).data('dynamite'), instance = null;

			if (id) {
				instance = instances[id] || null;

				if (instance === null) {
					return;
				}
			} else {
				id = instanceCount++;
				$(this).data('dynamite', id);
			}
			if (instance === null || typeof options !== 'undefined') {
				instance = new Dynamite(this, options);
				instances[id] = instance;
			} else {
				apis.push(instance);
			}
		}),
		apiCount = apis.length;

		if (apiCount) {
			return apiCount === 1 ? apis[0] : apis;
		} else {
			return elements;
		}
	};

	$(function() {
		if (!$('[data-dynamite-detect=false]').first().length) {
			$('[data-dynamite]').dynamite();
		}
	});

}(window, document, window.Zepto || window.jQuery);