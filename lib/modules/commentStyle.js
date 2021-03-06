/* @flow */

import { Module } from '../core/module';
import { addCSS } from '../utils';

export const module: Module<*> = new Module('commentStyle');

module.moduleName = 'commentStyleName';
module.category = 'appearanceCategory';
module.description = 'commentStyleDesc';
module.options = {
	commentBoxes: {
		type: 'boolean',
		value: true,
		description: 'commentStyleCommentBoxesDesc',
		bodyClass: 'res-commentBoxes',
	},
	commentRounded: {
		type: 'boolean',
		value: true,
		description: 'commentStyleCommentRoundedDesc',
		advanced: true,
		dependsOn: 'commentBoxes',
		bodyClass: 'res-commentBoxes-rounded',
	},
	commentHoverBorder: {
		type: 'boolean',
		value: false,
		description: 'commentStyleCommentHoverBorderDesc',
		advanced: true,
		dependsOn: 'commentBoxes',
		bodyClass: 'res-commentHoverBorder',
	},
	commentIndent: {
		type: 'text',
		value: '10',
		description: 'commentStyleCommentIndentDesc',
		advanced: true,
		dependsOn: 'commentBoxes',
	},
	continuity: {
		type: 'boolean',
		value: false,
		description: 'commentStyleContinuityDesc',
		advanced: true,
		dependsOn: 'commentBoxes',
		bodyClass: 'res-continuity',
	},
};

module.include = [
	'comments',
];

module.beforeLoad = () => {
	if (module.options.commentBoxes.value && module.options.commentIndent.value) {
		// this should override the default of 10px in commentboxes.css because it's added later.
		addCSS(`
			.res-commentBoxes .comment {
				margin-left: ${module.options.commentIndent.value}px !important;
			}
		`);
	}
};
