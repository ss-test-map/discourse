import EmberObject from "@ember/object";
import { guidFor } from "@ember/object/internals";
import $ from "jquery";
import { withoutPrefix } from "discourse-common/lib/get-url";

let popstateFired = false;
const supportsHistoryState = window.history && "state" in window.history;
const popstateCallbacks = [];

function _uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    let r, v;
    /* eslint-disable no-bitwise */
    r = (Math.random() * 16) | 0;
    v = c === "x" ? r : (r & 3) | 8;
    /* eslint-enable no-bitwise */
    return v.toString(16);
  });
}

/**
  `Ember.DiscourseLocation` implements the location API using the browser's
  `history.pushState` API.

  @class DiscourseLocation
  @namespace Discourse
  @extends @ember/object
*/
const DiscourseLocation = EmberObject.extend({
  init() {
    this._super(...arguments);

    this.set("location", this.location || window.location);

    this.initState();
  },

  /**
    @private

    Used to set state on first call to setURL

    @method initState
  */
  initState() {
    const history = this.history || window.history;
    if (history && history.scrollRestoration) {
      history.scrollRestoration = "manual";
    }

    this.set("history", history);

    let url = this.formatURL(this.getURL());

    if (this.location && this.location.hash) {
      url += this.location.hash;
    }

    this.replaceState(url);
  },

  /**
    Will be pre-pended to path upon state change

    @property rootURL
    @default '/'
  */
  rootURL: "/",

  /**
    @private

    Returns the current `location.pathname` without rootURL

    @method getURL
  */
  getURL() {
    let url = withoutPrefix(this.location.pathname);
    const search = this.location.search || "";
    url += search;
    url = url.replace(/\/\//g, "/"); // remove extra slashes
    return url;
  },

  /**
    @private

    Uses `history.pushState` to update the url without a page reload.

    @method setURL
    @param path {String}
  */
  setURL(path) {
    const state = this.getState();
    path = this.formatURL(path);

    if (state && state.path !== path) {
      this.pushState(path);
    }
  },

  /**
    @private

    Uses `history.replaceState` to update the url without a page reload
    or history modification.

    @method replaceURL
    @param path {String}
  */
  replaceURL(path) {
    const state = this.getState();
    path = this.formatURL(path);

    if (!state || state.path !== path) {
      this.replaceState(path);
    }
  },

  /**
   @private

   Get the current `history.state`
   Polyfill checks for native browser support and falls back to retrieving
   from a private _historyState variable

   @method getState
  */
  getState() {
    return supportsHistoryState ? this.history.state : this._historyState;
  },

  /**
   @private

   Pushes a new state

   @method pushState
   @param path {String}
  */
  pushState(path) {
    const state = { path, uuid: _uuid() };

    // store state if browser doesn't support `history.state`
    if (!supportsHistoryState) {
      this._historyState = state;
    } else {
      this.history.pushState(state, null, path);
    }

    // used for webkit workaround
    this._previousURL = this.getURL();
  },

  /**
   @private

   Replaces the current state

   @method replaceState
   @param path {String}
  */
  replaceState(path) {
    const state = { path, uuid: _uuid() };

    // store state if browser doesn't support `history.state`
    if (!supportsHistoryState) {
      this._historyState = state;
    } else {
      this.history.replaceState(state, null, path);
    }

    // used for webkit workaround
    this._previousURL = this.getURL();
  },

  /**
    @private

    Register a callback to be invoked whenever the browser
    history changes, including using forward and back buttons.

    @method onUpdateURL
    @param callback {Function}
  */
  onUpdateURL(callback) {
    const guid = guidFor(this);

    $(window).on(`popstate.ember-location-${guid}`, () => {
      const url = this.getURL();

      // Ignore initial page load popstate event in Chrome
      if (!popstateFired) {
        popstateFired = true;
        if (url === this._previousURL) {
          return;
        }
      }

      popstateCallbacks.forEach((cb) => cb(url));
      callback(url);
    });
  },

  /**
    @private

    Used when using `{{action}}` helper.  The url is always appended to the rootURL.

    @method formatURL
    @param url {String}
  */
  formatURL(url) {
    let rootURL = this.rootURL;

    if (url !== "") {
      rootURL = rootURL.replace(/\/$/, "");

      if (rootURL.length > 0 && url.startsWith(rootURL + "/")) {
        rootURL = "";
      }
    }

    return rootURL + url;
  },

  willDestroy() {
    this._super(...arguments);

    const guid = guidFor(this);
    $(window).off(`popstate.ember-location-${guid}`);
  },
});

export default DiscourseLocation;
