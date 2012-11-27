// JIRA5 Tree Viwer
// Version 0.2.0 (for JIRA 5.1)
// 11-09-2012
// Autor: Slava Yurin <YurinVV@ya.ru>

// ==UserScript==
// @name		  JIRA5 Tree Viewr
// @namespace	  http://jira.ngs.local/
// @description   Show you project as tree
// @match		  http://jira.ngs.local/*
// @match		  http://jira/*
// @version		  0.2.0
// @include		  http://jira.ngs.local/*
// @include		  http://jira/*
// ==/UserScript==

(function() {
	var fun = function($) {
		var tree = function() {
			// Получение списка предыдущих компонент
			var parent_list = function(node) {
				var list = [node.attr('id')];
				var par = $.jstree._focused()._get_parent(node);
				while (par != -1) {
					list.push(par.attr('id'));
					par = $.jstree._focused()._get_parent(par);
				}

				return list;
			}
			// Определяем окуда надо брать данные
			var get_url = function(node) {
				var url = "";

				if (node == -1) {
					url = "/rest/api/latest/project/MAILSERVER/components"
				} else {
					// TODO: несколько компонент
					var IDs = parent_list(node).join("+and+component+=+");
					url = "/rest/api/latest/search?jql=component+=+" + IDs;
				}

				return url;
			};

			// Обработка полученных данных
			var parse_data = function(data) {
				if (data.issues != undefined) {
					var componentsID = parent_list(this);

					var componentIssues = [];
					data.issues.forEach(function(issue) {
						if (issue.fields.components.length == componentsID.length) {
							var node = {
								state: "closed",
								data: {
									attr: {
										id: issue.id,
										href: "/browse/" + issue.key
									},
									title: issue.key + ": " + issue.fields.summary,
									icon: issue.fields.issuetype.iconUrl,
									_disabled: false
								},
								metadata: {
									priority: "<img src='" + issue.fields.priority.iconUrl + "' title='" + issue.fields.priority.name + "'/>",
									'status': "<img src='" + issue.fields['status'].iconUrl + "' title='" + issue.fields['status'].name + "'/>"
								},
								children: issue.fields.subtasks.map(function(subissue) {
									return {
										data: {
											attr: {
												id: subissue.id,
												href: "/browse/" + subissue.key
											},
											title: subissue.key + ": " + subissue.fields.summary,
											icon: subissue.fields.issuetype.iconUrl,
											_disabled: false
										},
										metadata: {
											priority: "<ins style='background-image: url(" + subissue.fields.priority.iconUrl + ");'/>"
										}
									};
								})
							};
							if (issue.fields.subtasks.length == 0) {
								delete node.state;
							}
							componentIssues.push(node);
						}
					});

					var componentsInComponent = [];
					var length = componentsID.length + 1;

					data.issues.forEach(function(issue) {
						if (issue.fields.components.length == length) {
							issue.fields.components.forEach(function(component) {
								if(componentsID.indexOf(component.id) == -1) {
									componentsID.push(component.id);
									componentsInComponent.push({
										state: "closed",
										attr: {
											id: component.id
										},
										data: {
											title: component.name,
										},
										metadata: {
											type: 'component'
										}
									});
								}
							});
						}
					});

					return componentsInComponent.concat(componentIssues);
				} else {
					return data.map(function(Component) {
						return {
							state: "closed",
							attr: {
								id: Component.id
							},
							data: {
								title: Component.name,
							}
						}
					});
				}
			};



			var tree = $('div#tree');

			tree.empty();
			tree.append('<ul></ul>');
			tree.jstree({
				plugins: ['themes', 'json_data', 'grid'],
				grid: {
					// Поля таблицы
					columns: [
						{width: 650, header: 'Задачи'},
						{width: 23, header: '', value: 'priority', source: 'metadata'},
						{width: 23, header: '', value: 'status', source: 'metadata'}
					],
					resizable: true
				},
				json_data: {
					ajax: {
						type: 'GET',
						url: get_url,
						success: parse_data
					},
					"correct_state": true
				},
				themes: {
					theme: 'apple',
					url: 'http://static.jstree.com/v.1.0pre/themes/apple/style.css'
				},
				_disabled: true
			});
		};

		// Ищем гадреты для замены
		var gadget = jQuery('div.gadget-container h3.dashboard-item-title').filter(function() {
			return (jQuery(this).text() == 'Structure');
		});
		var iframe = gadget.parent().parent().find('iframe');
		var gadgetID = [];
		iframe.each(function(ID) {
			gadgetID.push($(this).attr('id'));
		});

		// Заменяем гаджет на свой
		gadgetID.forEach(function(ID) {
			var iframe = jQuery('#' + ID);
			iframe.attr('src', '//about:blank');
			iframe.removeAttr('scrolling');
			iframe.addClass('tree-frame');

			window.frames[ID].document.open('text/html', 'replace');
			window.frames[ID].document.write(
				"<html style='height: " + iframe.attr('height') + "px; overflow: auto;'>" +
					"<head>" +
						'<script src="//ajax.googleapis.com/ajax/libs/jquery/1.8.3/jquery.min.js"></script>' +
						'<script src="https://raw.github.com/nevar/jstree/v.pre1.0/jquery.jstree.js"></script>' +
						'<script src="https://raw.github.com/deitch/jstree-grid/master/jstreegrid.js"></script>' +
						'<script>' +
							"$(" + tree.toString() + ")" +
						'</script>' +
					"</head>" +
					"<body style='height: " + iframe.attr('height') + "px; overflow: auto; margin: 0px;'>" +
						"<div id='tree'></div>" + // Сюда будет вставлено дерево проекта
					"</body>" +
				"</html>");
			window.frames[ID].document.close();
		});
	};

	var script = document.createElement("script");
	script.textContent = "(" + fun.toString() + ")(jQuery);";
	document.body.appendChild(script);
}());
