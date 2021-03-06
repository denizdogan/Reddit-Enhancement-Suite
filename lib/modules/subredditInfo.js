/* @flow */

import { $ } from '../vendor';
import { Module } from '../core/module';
import * as Modules from '../core/modules';
import {
	HOUR,
	formatDate,
	formatDateDiff,
	formatNumber,
	loggedInUser,
	isEmptyLink,
	regexes,
	string,
} from '../utils';
import type { RedditSubreddit } from '../types/reddit';
import { ajax } from '../environment';
import * as Dashboard from './dashboard';
import * as FilteReddit from './filteReddit';
import * as Hover from './hover';
import * as SubredditManager from './subredditManager';

export const module: Module<*> = new Module('subredditInfo');

module.moduleName = 'subredditInfoName';
module.category = 'subredditsCategory';
module.description = 'subredditInfoDesc';
module.options = {
	requireDirectLink: {
		type: 'boolean',
		value: true,
		description: 'Should the popup appear only for direct /r/ links, or for all links to a subreddit?',
	},
	hoverDelay: {
		type: 'text',
		value: '800',
		description: 'Delay, in milliseconds, before hover tooltip loads. Default is 800.',
		advanced: true,
	},
	fadeDelay: {
		type: 'text',
		value: '200',
		description: 'Delay, in milliseconds, before hover tooltip fades away. Default is 200.',
		advanced: true,
	},
	fadeSpeed: {
		type: 'text',
		value: '0.7',
		description: 'Fade animation\'s speed (in seconds). Default is 0.7.',
		advanced: true,
	},
};

module.go = () => {
	const linkSelector = [
		'a.subreddit',
		'a.search-subreddit-link',
		'.md a[href^="/r/"]',
		!module.options.requireDirectLink.value && '.md a[href*="reddit.com/r/"]',
	].filter(x => x).join(', ');

	$(document.body).on('mouseover', linkSelector, handleMouseOver);
};

function handleMouseOver(e: Event) {
	// ensure it's a local link, in case some other website could have /r/ in its URLs.
	const target: HTMLAnchorElement = (e.target: any);
	if (
		isEmptyLink(target) ||
		!target.hostname.endsWith('.reddit.com') ||
		target.textContent.startsWith('self.')
	) {
		return;
	}

	Hover.infocard(module.moduleID)
		.target(target)
		.options({
			width: 450,
			openDelay: module.options.hoverDelay.value,
			fadeDelay: module.options.fadeDelay.value,
			fadeSpeed: module.options.fadeSpeed.value,
		})
		.populateWith(showSubredditInfo)
		.begin();
}

async function showSubredditInfo(ele, update) {
	const subreddit = (ele: any).pathname.match(regexes.subreddit)[1];
	const header = document.createElement('div');
	const $link = $(string.escapeHTML`<a href="/r/${subreddit}">/r/${subreddit}</a>`);
	header.appendChild($link[0]);

	if (loggedInUser()) {
		const subscribeToggle = $('<span />')
			.attr('id', 'RESHoverInfoSubscriptionButton')
			.addClass('res-fancy-toggle-button')
			.css('margin-left', '12px')
			.hide()
			.on('click', toggleSubscription);
		updateToggleButton(subscribeToggle[0], false);
		header.appendChild(subscribeToggle[0]);
	}

	update(header);

	let jsonData;
	try {
		jsonData = (await ajax({
			url: `/r/${subreddit.toLowerCase()}/about.json`,
			type: 'json',
			cacheFor: HOUR,
		}): RedditSubreddit);
	} catch (e) {
		return [null, 'Error loading subreddit info'];
	}

	if (jsonData.kind !== 't5') {
		return [null, 'Subreddit not found'];
	}

	const d = new Date(jsonData.data.created_utc * 1000);

	const $newBody = $(string.escapeHTML`
		<div class="subredditInfoToolTip">
		<div class="subredditLabel">Subreddit created:</div> <div class="subredditDetail">${formatDate(d)} (${formatDateDiff(d)})</div>
		<div class="subredditLabel">Subscribers:</div> <div class="subredditDetail">${formatNumber(jsonData.data.subscribers)}</div>
		<div class="subredditLabel">Title:</div> <div class="subredditDetail">${jsonData.data.title}</div>
		<div class="subredditLabel">Over 18:</div> <div class="subredditDetail">${jsonData.data.over18 ? 'Yes' : 'No'}</div>
		<div class="clear"></div><div id="subTooltipButtons" class="bottomButtons">
		<div class="clear"></div>
		</div></div>
	`);

	// bottom buttons will include: +filter +shortcut +dashboard (maybe sub/unsub too?)
	if (Modules.isRunning(SubredditManager)) {
		const theSC = document.createElement('span');
		theSC.setAttribute('class', 'res-fancy-toggle-button REStoggle RESshortcut');
		theSC.setAttribute('data-subreddit', jsonData.data.display_name.toLowerCase());
		const idx = SubredditManager.mySubredditShortcuts.findIndex(shortcut => shortcut.subreddit.toLowerCase() === jsonData.data.display_name.toLowerCase());
		if (idx !== -1) {
			theSC.textContent = '-shortcut';
			theSC.setAttribute('title', 'Remove this subreddit from your shortcut bar');
			theSC.classList.add('remove');
		} else {
			theSC.textContent = '+shortcut';
			theSC.setAttribute('title', 'Add this subreddit to your shortcut bar');
		}
		theSC.addEventListener('click', SubredditManager.toggleSubredditShortcut);

		$newBody.find('#subTooltipButtons').append(theSC);
	}

	if (Modules.isEnabled(Dashboard)) {
		const dashboardToggle = document.createElement('span');
		dashboardToggle.setAttribute('class', 'res-fancy-toggle-button RESDashboardToggle');
		dashboardToggle.setAttribute('data-subreddit', jsonData.data.display_name.toLowerCase());
		const exists = Dashboard.subredditWidgetExists(jsonData.data.display_name);
		if (exists) {
			dashboardToggle.textContent = '-dashboard';
			dashboardToggle.setAttribute('title', 'Remove this subreddit from your dashboard');
			dashboardToggle.classList.add('remove');
		} else {
			dashboardToggle.textContent = '+dashboard';
			dashboardToggle.setAttribute('title', 'Add this subreddit to your dashboard');
		}
		dashboardToggle.addEventListener('click', Dashboard.toggleDashboard);
		$newBody.find('#subTooltipButtons').append(dashboardToggle);
	}

	if (Modules.isEnabled(FilteReddit)) {
		const filterToggle = document.createElement('span');
		filterToggle.setAttribute('class', 'res-fancy-toggle-button RESFilterToggle');
		const subredditNameLowercase = jsonData.data.display_name.toLowerCase();
		const filteredReddits = FilteReddit.module.options.subreddits.value;
		const exists = filteredReddits.some(reddit =>
			reddit && (reddit[0].toLowerCase() === subredditNameLowercase)
		);
		if (exists) {
			filterToggle.textContent = '-filter';
			filterToggle.setAttribute('title', 'Stop filtering from /r/all and /domain/*');
			filterToggle.classList.add('remove');
		} else {
			filterToggle.textContent = '+filter';
			filterToggle.setAttribute('title', 'Filter this subreddit from /r/all and /domain/*');
		}
		filterToggle.addEventListener('click', (e: Event) => {
			const added = FilteReddit.toggleFilter(subredditNameLowercase);

			if (added) {
				e.target.setAttribute('title', 'Stop filtering this subreddit from /r/all and /domain/*');
				e.target.textContent = '-filter';
				e.target.classList.add('remove');
			} else {
				e.target.setAttribute('title', 'Filter this subreddit from /r/all and /domain/*');
				e.target.textContent = '+filter';
				e.target.classList.remove('remove');
			}
		});
		$newBody.find('#subTooltipButtons').append(filterToggle);
	}

	if (loggedInUser()) {
		const subscribed = !!jsonData.data.user_is_subscriber;
		const $subscribeToggle = $('#RESHoverInfoSubscriptionButton');
		$subscribeToggle.attr('data-subreddit', jsonData.data.display_name.toLowerCase());
		updateToggleButton($subscribeToggle[0], subscribed);
		if (Modules.isEnabled(SubredditManager)) {
			$subscribeToggle.after(await SubredditManager.getMultiCounts(jsonData.data.display_name));
		}
		$subscribeToggle.fadeIn('fast');
	}

	return [null, $newBody];
}

function updateToggleButton(toggleButton, subscribed) {
	const toggleOn = '+subscribe';
	const toggleOff = '-unsubscribe';
	if (subscribed) {
		toggleButton.textContent = toggleOff;
		toggleButton.classList.add('remove');
	} else {
		toggleButton.textContent = toggleOn;
		toggleButton.classList.remove('remove');
	}
}

async function toggleSubscription(e: Event) {
	// Get info
	const subscribeToggle = e.target;
	const subreddit = subscribeToggle.getAttribute('data-subreddit').toLowerCase();
	const { data: subredditData } = (await ajax({
		url: `/r/${subreddit}/about.json`,
		type: 'json',
		cacheFor: HOUR,
	}): RedditSubreddit);
	const subscribing = !subredditData.user_is_subscriber;

	updateToggleButton(subscribeToggle, subscribing);

	SubredditManager.subscribeToSubreddit(subredditData.name, subscribing);

	// We may have successfully subscribed, so invalidate the cache
	ajax.invalidate({ url: `/r/${subreddit}/about.json` });
}
