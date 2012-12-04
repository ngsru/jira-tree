// JIRA5 Tree Viwer
// Version 0.3.1 (for JIRA 5.1)
// 11-09-2012
// Autor: Slava Yurin <YurinVV@ya.ru>

// ==UserScript==
// @name		  JIRA5 Tree Viewr
// @namespace	  http://jira.ngs.local/
// @description   Show you project as tree
// @match		  http://jira.ngs.local/*
// @match		  http://jira/*
// @version		  0.3.1
// @include		  http://jira.ngs.local/*
// @include		  http://jira/*
// ==/UserScript==

(function() {
	var fun = function($) {
		// Ищем гаджеты для замены
		var gadget = jQuery('div.gadget-container h3.dashboard-item-title').filter(function() {
			return (jQuery(this).text() == 'Structure');
		});
		var iframe = gadget.parent().parent().find('iframe');
		var gadgetID = [];
		iframe.each(function(ID) {
			gadgetID.push($(this).attr('id'));
		});

		var tree = function(height) {
Ext.require([
    'Ext.data.*',
    'Ext.grid.*',
    'Ext.tree.*',
    'Ext.state.*'
]);

Ext.BLANK_IMAGE_URL = '/images/border/spacer.gif';

Ext.onReady(function() {
	var current_project;
	var filter = '&fields=summary,issuetype,priority,subtasks,components,status&maxResults=250';

	Ext.state.Manager.setProvider(new Ext.state.CookieProvider());

    Ext.define('Task', {
        extend: 'Ext.data.Model',
        fields: ['name', 'status']
    });

    var store = Ext.create('Ext.data.TreeStore', {
        model: 'Task',
		root: {
			expanded: false,
			children: []
		},
        folderSort: true
    });

	store.on('beforeload', function(store, op, eOpts) {
		var node = op.node;
		var componentIDs = [];

		while (!node.isRoot()) {
			componentIDs.push(node.raw.componentID);
			node = node.parentNode;
		}

		Ext.Ajax.request({
			url: '/rest/api/latest/search?jql=project=' + current_project.key + '+and+component='
				+ componentIDs.join('+and+component=') + filter,
			success: function(response) {
				add_child(op.node, componentIDs, response);
			}
		});

		return false;
	});


    var tree = Ext.create('Ext.tree.Panel', {
		id: "Tree",
        title: 'Дерево проекта',
        renderTo: Ext.getBody(),
        collapsible: true,
        useArrows: true,
        rootVisible: false,
        store: store,
        multiSelect: true,
        singleExpand: false,
		height: height,
        //the 'columns' property is now 'headers'
        columns: [{
            xtype: 'treecolumn', //this is so we know which column will show the tree
            text: 'Задачи',
            flex: 2,
            sortable: true,
            dataIndex: 'name',
			hideable: false
        },{
			xtype: 'templatecolumn',
            text: 'Состояние',
            flex: 1,
            dataIndex: 'status',
            sortable: true,
			tpl: Ext.create('Ext.XTemplate', '<img src={status}></img>')
        }],
		dockedItems: [],
		stateful: true,
		stateId: 'ProjectTree'
    });

	var add_child = function(node, level, response) {
		var data = Ext.decode(response.responseText);
		var existsID = level.slice();
		var issue;

		for(var i = 0, l = node.childNodes.length; i < l; i++) {
			if (node.childNodes[i].raw.componentID) {
				existsID.push(node.childNodes[i].raw.componentID);
			}
		}

		for(var i = 0, l = data.issues.length; i < l; i++) {
			issue = data.issues[i];

			if (issue.fields.components.length == level.length + 1) {
				// компонента на следующем уровне
				var component = issue.fields.components.filter(function(component) {
					return existsID.indexOf(component.id) < 0;
				})[0];
				if (component) {
					// И её ещё нету в списке
					existsID.push(component.id);

					// Добавляем новую компоненту и ставим, чтобы она
					// загрузилась при её раскрытии
					appendedNode = node.appendChild({
						name: component.name,
						componentID: component.id,
						leaf: false
					});
					appendedNode.set('loaded', false);
				}
			} if (issue.fields.components.length == level.length) {
				// Добавляем новую задачу на этом уровне
				node.appendChild({
					children: issue.fields.subtasks.map(function(subtask) {
						return {
							name: Ext.util.Format.htmlEncode(subtask.key + ": " + subtask.fields.summary),
							href: 'http://jira.ngs.local/browse/' + subtask.key,
							icon: subtask.fields.issuetype.iconUrl,
							'status': subtask.fields['status'].iconUrl,
							leaf: true
						};
					}),
					name: Ext.util.Format.htmlEncode(issue.key + ": " + issue.fields.summary),
					icon: issue.fields.issuetype.iconUrl,
					href: 'http://jira.ngs.local/browse/' + issue.key,
					leaf: issue.fields.subtasks.length == 0,
					'status': issue.fields['status'].iconUrl
				});
			}
		}

		var start = data.startAt + data.maxResults;

		if (data.total > start) {
			// Есть ещё страницы
			Ext.Ajax.request({
				url: '/rest/api/latest/search?jql=project=' + current_project.key +
					(node.isRoot() ? '' : '+and+component=') +
					level.join('+and+component=') +
					'&startAt=' + start.toString() + filter,
				success: function(response) {
					add_child(node, level, response);
				}
			});
		} else {
			node.set('loading', false);
			node.expand();
			node.sort(function(nodeA, nodeB) {
				if ((nodeA.raw.componentID && nodeB.raw.componentID) ||
					(!nodeA.raw.componentID && !nodeB.raw.componentID)){
					if (nodeA.data.name > nodeB.data.name) {
						return 1;
					} if (nodeA.data.name < nodeB.data.name) {
						return -1;
					}
					return 0;
				} else if (nodeA.raw.componentID) {
					return -1;
				} else {
					return 1;
				}
			});

			if (node.isRoot()) {
				tree.setLoading(false);
			}
		}
	};

	var select_project = function(project) {
		// Начинаем загрузку проекта
		tree.setLoading("Построение дерева проекта");
		tree.setRootNode({name: project.key, children: []});
		tree.getRootNode().collapse();

		Ext.Ajax.request({
			url: '/rest/api/latest/search?jql=project=' + project.key + filter,
			success: function(response) {
				add_child(tree.getRootNode(), [], response);
			}
		});
	};

	var project_selector = Ext.create('Ext.menu.Menu', {
		stateful: false
	});

	tree.addDocked({
		xtype: 'toolbar',
		id: 'TreeToolBar',
		items: [{
			text: 'Выберете проект',
			id: 'SelectedProject',

			stateful: true,
			stateEvents: ['click'],
			stateId: 'SelectedProject',

			getState: function() {
				// Сохраняем выбранный проект
				return current_project;
			},

			listeners: {
				// Загружаем выбраный проект
				staterestore: function(stateful, state, eOpts) {
					if (state.key && state.name) {
						current_project = state
						select_project(state);

						this.setIconCls(state.key);
						this.setText(state.name);
					}
				}
			},

			menu: project_selector
		}]
	});

	Ext.Ajax.request({
		url: '/rest/api/latest/project',
		success: function(response) {
			var projects = Ext.decode(response.responseText),
				project;

			for(var i = 0, l = projects.length; i < l; i++) {
				project = projects[i];

				Ext.util.CSS.createStyleSheet('.' + project.key + '{background-image: url("' + project.avatarUrls['16x16'] + '")}');
				project_selector.add({
					text: project.name,
					iconCls: project.key,
					handler: function(item) {
						var info = {
							key: item.renderData.iconCls,
							name: Ext.util.Format.htmlEncode(item.renderData.text)
						};
						current_project = info;
						select_project(info);

						var selectButton = this.parentMenu.ownerButton;
						selectButton.setIconCls(info.key);
						selectButton.setText(info.name);
					}
				});
			}
		}
	});
});

		};

		var height = 500;
		var script =
			"<html style='height: " + height + "px; overflow: auto;'>" +
				"<head>" +
					'<link rel="stylesheet" type="text/css" href="http://dev.sencha.com/deploy/ext-4.1.0-gpl/resources/css/ext-all.css"/>' +
					'<script src="http://cdn.sencha.io/ext-4.1.1-gpl/ext-all.js"></script>' +
					'<script>' +
						"(" + tree.toString() + ")(" + height + ");" +
					'</script>' +
				"</head>" +
				"<body style='height: " + height + "px; overflow: auto; margin: 0px;'>" +
				"</body>" +
			"</html>";
		var ID, element;

		// Заменяем гаджет на свой
		for(var i = 0, l = gadgetID.length; i < l; i++) {
			ID = gadgetID[i];

			// Обновление размеров гаджета в дашборе JIR-ы
			var element = document.getElementById(ID);
			element.style.height = height + 'px';
			element.src = '//about:blank';
			jQuery(AG).trigger("AG.iframeResize", [element, height]);

			window.frames[ID].document.open('text/html', 'replace');
			window.frames[ID].document.write(script);
			window.frames[ID].document.close();
		}
	};

	var script = document.createElement("script");
	script.textContent = "(" + fun.toString() + ")(jQuery);";
	document.body.appendChild(script);
}());
