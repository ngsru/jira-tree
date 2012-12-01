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
    'Ext.tree.*'
]);

Ext.onReady(function() {
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
			url: '/rest/api/latest/search?jql=project=MAILSERVER+and+component='
				+ componentIDs.join('+and+component='),
			success: function(response) {
				add_child(op.node, componentIDs, response);
			}
		});

		return false;
	});

    var tree = Ext.create('Ext.tree.Panel', {
		id: "Tree",
        title: 'Core Team Projects',
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
            dataIndex: 'name'
        },{
			xtype: 'templatecolumn',
            text: 'Состояние',
            flex: 1,
            dataIndex: 'status',
            sortable: true,
			tpl: Ext.create('Ext.XTemplate', '<img src={status}></img>')
        }]
    });

	var add_child = function(node, level, response) {
		var data = Ext.decode(response.responseText);
		var existsID = level.slice();

		node.childNodes.forEach(function(child) {
			if (child.raw.componentID) {
				existsID.push(child.raw.componentID);
			}
		});

		data.issues.forEach(function(issue) {
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
							name: subtask.key + ": " + subtask.fields.summary,
							href: 'http://jira.ngs.local/browse/' + subtask.key,
							icon: subtask.fields.issuetype.iconUrl,
							'status': subtask.fields['status'].iconUrl,
							leaf: true
						};
					}),
					name: issue.key + ": " + issue.fields.summary,
					icon: issue.fields.issuetype.iconUrl,
					href: 'http://jira.ngs.local/browse/' + issue.key,
					leaf: issue.fields.subtasks.length == 0,
					'status': issue.fields['status'].iconUrl
				});
			}
		});

		var start = data.startAt + data.maxResults;

		if (data.total > start) {
			// Есть ещё страницы
			Ext.Ajax.request({
				url: '/rest/api/latest/search?jql=project=MAILSERVER+' +
					(node.isRoot() ? '' : 'and+component=') +
					level.join('+and+component=') +
					'&startAt=' + start.toString(),
				success: function(response) {
					add_child(node, level, response);
				}
			});
		} else {
			node.sort(function(nodeA, nodeB) {
				if ((nodeA.isLeaf() && nodeB.isLeaf()) ||
					(!nodeA.isLeaf() && !nodeB.isLeaf())) {
					if (nodeA.raw.name > nodeB.data.name) {
						return 1;
					} if (nodeA.raw.name < nodeB.data.name) {
						return -1;
					}
					return 0;
				} else {
					if (nodeA.isLeaf()) {
						return 1;
					} else {
						return -1;
					}
				}
			});

			if (node.isRoot()) {
				tree.setLoading(false);
			} else {
				node.set('loading', false);
				node.expand();
			}
		}
	};

	tree.setLoading("Построение дерева проекта");

	Ext.Ajax.request({
		url: '/rest/api/latest/search?jql=project=MAILSERVER',
		success: function(response) {
			add_child(tree.getRootNode(), [], response);
		}
	});
});

		};

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
						'<link rel="stylesheet" type="text/css" href="http://dev.sencha.com/deploy/ext-4.1.0-gpl/resources/css/ext-all.css"/>' +
						'<script src="http://cdn.sencha.io/ext-4.1.1-gpl/ext-all-debug.js"></script>' +
						'<script>' +
							"(" + tree.toString() + ")(" + iframe.attr('height') + ");" +
						'</script>' +
					"</head>" +
					"<body style='height: " + iframe.attr('height') + "px; overflow: auto; margin: 0px;'>" +
					"</body>" +
				"</html>");
			window.frames[ID].document.close();
		});
	};

	var script = document.createElement("script");
	script.textContent = "(" + fun.toString() + ")(jQuery);";
	document.body.appendChild(script);
}());
