// JIRA5 Tree Viwer
// Version 0.1 (for JIRA 5.1)
// 11-09-2012
// Autor: Slava Yurin <YurinVV@ya.ru>

// ==UserScript==
// @name		  JIRA5 Tree Viewr
// @namespace	  http://jira.ngs.local/
// @description   Show you project as tree
// @match		  http://jira.ngs.local/*
// @match		  http://jira/*
// @version		  0.1
// @include		  http://jira.ngs.local/*
// @include		  http://jira/*
// ==/UserScript==

(function() {
	var fun = function($) {
		window.jQuery.getScript("https://raw.github.com/nevar/jstree/v.pre1.0/jquery.jstree.js", function() {
		window.jQuery.getScript("https://raw.github.com/deitch/jstree-grid/master/jstreegrid.js", function() {
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
									// Надо добавить поля для отображения
									// (Приоритет, Кому назначено, сколько
									// времени потрачено ...)
									test: "$10"
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


			if ($('div.layout-a').length == 1) {
				var tree = $('div.layout-a');

				tree.empty();
				tree.append('<ul></ul>');
				tree.jstree({
					plugins: ['themes', 'json_data', 'grid'],
					grid: {
						// Поля таблицы
						columns: [
							{width: 650, header: 'Задачи'},
							{width: 60, header: 'Просто тест', value: 'test', source: 'metadata'}
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
			}
		});
		});
	};

	script = document.createElement("script");
	script.textContent = "(" + fun.toString() + ")(jQuery);";
	document.body.appendChild(script);
}());
