const { Route, Router, Link, hashHistory, IndexRoute } = ReactRouter;
const ReactCSSTransitionGroup = React.addons.CSSTransitionGroup;

/* @store */
class Store {
  constructor() {
    this.track = {};
    this.audio = new Audio();
  }
  setTrack(track) {
    this.track = track;
  }}


/* @classes */
class Notifier {
  constructor() {
    this.listeners = {};
  }
  on(event, cb) {
    this.listeners[event] = cb;
  }
  emit(event, data, ctx) {
    this.listeners[event](data);
  }}


class API {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }
  addQueryString(obj) {
    let query = '?';
    const res = Object.keys(obj).map(key => {
      return `${key}=${encodeURIComponent(obj[key])}`;
    });
    return query + res.join("&");
  }
  post({ url, data, headers = {}, fullUrl }) {
    return $.ajax({ url: fullUrl || `${this.baseUrl}/${url}`, data, headers, method: 'POST' });
  }
  get({ url, data, headers = {} }) {
    let full_url = `${this.baseUrl}/${url}${data ? this.addQueryString(data) : null}`;
    return $.ajax({ url: full_url, headers });
  }}


class SpotifyWrapper extends API {
  constructor(url, { clientID, clientSecret }) {
    super(url);
    this.clientID = clientID;
    this.clientSecret = clientSecret;
    this.accessToken = null;
    this.getAccess().then(data => {
      console.log(data);
      if (!data) {
        return;
      }
      console.log(data);
      this.accessToken = Object.assign({}, JSON.parse(data), { last_accessed: new Date() });
    });
  }
  getAccess() {
    console.log("hello");
    return $.ajax({
      url: 'https://nervous-davinci-7fb2d5.netlify.com/.netlify/functions/server/api/spotify' });

  }
  findTrack({ artist, track }) {
    if (this.accessToken === null) {
      return new Promise((res, rej) => rej('No access token could be found'));
    }
    return this.get({
      url: 'search/',
      data: {
        q: `track:${track} artist:${artist}`,
        type: 'track',
        include_external: 'audio' },

      headers: {
        Authorization: `Bearer ${this.accessToken.access_token}` } }).

    then(this.renderTrack.bind(this));
  }
  renderTrack({ tracks }) {
    return new Promise((res, rej) => {
      if (!tracks.items.length) {
        return rej('No tracks found.');
      }

      let { items } = tracks;

      const [track] = items.
      sort((x, y) => y.popularity - x.popularity);

      if (track == null) {
        return rej("No track found");
      }

      let { artists, preview_url, name, uri, duration_ms } = track;
      let { name: album_name, images: album_images } = track.album;
      res({
        artists, name, preview_url, uri,
        duration_ms, album_name, album_images });

    });
  }}


class GeniusWrapper extends API {
  constructor(url, accessToken) {
    super(url);
    this.accessToken = accessToken;
  }
  search({ lyrics }) {
    return this.get({
      url: 'search',
      data: {
        q: lyrics,
        access_token: this.accessToken } }).

    then(this.renderResult.bind(this));
  }
  renderResult({ response }) {
    let { hits } = response;
    return new Promise((res, rej) => {
      if (!hits.length) {
        return rej('No results found');
      }
      let result = hits[0].result;
      let { title, full_title, primary_artist } = result;
      let { image_url, name } = primary_artist;
      res({ title, full_title, image_url, name });
    });
  }}


let store = new Store();
let notifier = new Notifier();
let genius = new GeniusWrapper('https://api.genius.com', 'fHdWyb5Y9UABQQRi9PQFvmQJLtqAtX8sRc6gCLDPDyKpYpzj4n1C7Hb1PTznq1-4');
let spotify = new SpotifyWrapper('https://api.spotify.com/v1', {
  clientID: 'ec7596c1e6074aee9bed51ccc64ffaf7',
  clientSecret: 'fdc267c372fb446a8af1dd4aa4bc7b4f' });


/* @bridge function */
function getTrack(lyrics, success, progress, fail) {
  progress(`Fetching track using "${lyrics}"`);
  genius.
  search({
    lyrics: lyrics }).

  then(({ title, image_url, name }) => {
    progress(`Encontrando canciones con similar letra!`);
    spotify.
    findTrack({
      artist: name,
      track: title }).

    then(track => {
      progress(`Canción encontrada!`);
      success(track, image_url);
    }).
    fail(msg => fail({ text: msg, status: 'error' }));
  }).
  fail(msg => fail({ text: msg, status: 'error' }));
}

/* @components */
class DeferImage extends React.Component {
  constructor(props) {
    super(props);
    this.state = { src: '', prevSrc: '' };
  }
  render() {
    if (this.props.src !== undefined && this.props.src !== this.state.prevSrc) {
      this.setState({ prevSrc: this.props.src });
      let image = new Image();
      image.src = this.props.src;
      image.onload = () => {
        this.setState({ src: this.props.src });
      };
    }
    return (
      React.createElement("img", {
        src: this.state.src,
        ref: el => $(el).delay(10).fadeIn(parseInt(this.props.fade)) }));


  }}


class NotificationDisplay extends React.Component {
  constructor(props) {
    super(props);
  }
  render() {
    let notificationClass = '';
    if (this.props.message && this.props.message.hasOwnProperty('status')) {
      notificationClass = `notification notification-${this.props.message.status}`;
    }
    return (
      React.createElement("div", { className: notificationClass },
      this.props.message && this.props.message.text));


  }}


class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = { message: {} };
    notifier.on('update', this.updateStatus.bind(this));
  }
  updateStatus(message) {
    this.setState({ message: message });
    this.resetStatus();
  }
  resetStatus() {
    setTimeout(() => {
      this.setState({ message: {} });
    }, 2500);
  }
  render() {
    return (
      React.createElement("div", null,
      React.createElement(NotificationDisplay, { message: this.state.message }),
      React.createElement(ReactCSSTransitionGroup, {
        component: "div",
        transitionEnter: true,
        transitionAppear: true,
        transitionEnterTimeout: 1000,
        transitionLeaveTimeout: 500,
        transitionName: "example" },
      this.props.children ?
      React.cloneElement(this.props.children, {
        key: this.props.location.pathname }) :
      null)));




  }}


class DisplayLyrics extends React.Component {
  constructor(props) {
    super(props);
  }
  render() {
    let lyrics = 'Pulsa el botón blanco y decí la letra al mic...';
    if (this.props.lyrics !== '') {
      lyrics = this.props.lyrics;
    }
    return (
      React.createElement("div", { className: "display-lyrics" },

      lyrics && lyrics.split(' ').map(lyric => {
        return (
          React.createElement("span", { className: "display-lyric" },
          lyric));


      })));



  }}


class Home extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      listening: false,
      loading: false,
      loadingStatus: '',
      lyrics: '' };

    try {
      this.setupRecognition();
    } catch (e) {
      hashHistory.push('/support');
    }
  }
  setupRecognition() {
    this.recognition = new webkitSpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.onresult = this.renderLyrics.bind(this);
    this.recognition.onnomatch = this.sendNotification.bind(this);
    this.recognition.onerror = this.sendNotification.bind(this);
  }
  renderLyrics(e) {
    let interimScript = '';
    let results = [].slice.apply(e.results);
    results.forEach(result => {
      let { transcript } = result[0];
      if (result.isFinal) {
        this.recognition.stop();
        interimScript += transcript;
        this.toggleLoading(true);
        getTrack(
        interimScript,
        this.toResultsView.bind(this),
        this.setLoadingMessage.bind(this),
        this.sendNotification.bind(this));

        interimScript = '';
      } else {
        interimScript += transcript;
      }
    });
    this.updateLyrics(interimScript);
  }
  updateLyrics(userLyrics) {
    this.setState({ lyrics: userLyrics });
  }
  resetLyrics() {
    this.recognition.abort();
    this.toggleLoading(false);
    this.setState({ listening: false, lyrics: '' });
  }
  listenForLyrics() {
    if (this.state.listening) {
      this.setState({ listening: false });
      this.recognition.stop();
    } else {
      this.setState({ listening: true });
      this.recognition.start();
    }
  }
  sendNotification(message) {
    notifier.emit('update', message);
    if (message.status === 'error') {
      this.toggleLoading(false);
      this.setState({ listening: false });
    }
  }
  toggleLoading(status) {
    this.setState({ loading: status });
  }
  setLoadingMessage(msg) {
    this.setState({ loadingStatus: msg });
  }
  toResultsView(track, image_url) {
    track.image_url = image_url;
    this.toggleLoading(false);
    store.setTrack(track);
    hashHistory.push('/result');
  }
  render() {
    function slashMic(state, isListening) {
      return () => {
        let icon = $('#record').find('i');
        if (isListening && state) {
          icon.addClass('fa-microphone-slash');
        } else if (!state) {
          icon.removeClass('fa-microphone-slash');
        }
      };
    }
    return (
      React.createElement("div", { className: "home" },
      React.createElement("div", {
        className: "record-partial",
        style: { 'display': this.state.loading ? 'none' : 'block' } },
      React.createElement(DisplayLyrics, { lyrics: this.state.lyrics }),
      React.createElement("button", {
        id: "record",
        onClick: () => this.listenForLyrics(),
        onMouseOver: slashMic(true, this.state.listening),
        onMouseOut: slashMic(false, this.state.listening),
        className: this.state.listening ? 'btn-mic pulse' : 'btn-mic' },
      React.createElement("i", { className: "fa fa-microphone" })),

      React.createElement("div", { className: "btn-container" },
      React.createElement("button", { onClick: () => this.resetLyrics(), className: "btn" },
      React.createElement("i", { className: "fa fa-repeat" }),
      React.createElement("span", null, "Reiniciar")))),



      React.createElement("div", {
        className: "loading-partial",
        style: { 'display': this.state.loading ? 'block' : 'none' } },
      React.createElement("div", { className: "loader-container" },
      React.createElement("div", { className: "loader" })),

      React.createElement("p", { className: "loader-status" },
      this.state.loadingStatus))));




  }}


class MusicPlayer extends React.Component {
  constructor(props) {
    super(props);
    this.state = { current: 0, prevSrc: '', interval: {}, playing: false };
  }
  componentDidUpdate({ src }) {
    if (src !== this.state.prevSrc) {
      this.state.prevSrc = this.props.src;
      store.audio.src = this.props.src;
      store.audio.play();
      this.setState({ playing: !store.audio.paused });
    }
  }
  componentWillUnmount() {
    clearInterval(this.state.interval);
  }
  componentWillMount() {
    this.updateProgress();
  }
  controlAudio() {
    store.audio.paused ? this.play() : this.pause();
  }
  play() {
    store.audio.play();
    this.setState({ playing: true });
  }
  pause() {
    store.audio.pause();
    this.setState({ playing: false });
  }
  updateProgress() {
    this.state.interval = setInterval(function () {
      let state = {
        current: store.audio.currentTime / store.audio.duration * 100 };

      if (state.current === 100) {
        state.playing = false;
      }
      this.setState(state);
    }.bind(this), 1000);
  }
  render() {
    return (
      React.createElement("div", { className: "audio-player" },
      React.createElement("div", { className: "audio-bar" },
      React.createElement("div", {
        className: "audio-progress",
        style: { width: `${this.state.current}%` } })),


      React.createElement("div", { className: "audio-controls" },
      React.createElement("button", {
        id: "audio-play-pause",
        className: this.state.playing ? 'btn-control pause' : 'btn-control play',
        onClick: () => this.controlAudio() }))));




  }}


class Results extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      track: {
        artists: [],
        album_images: [] } };


  }
  componentDidMount() {
    this.setState({
      track: store.track });

  }
  toHomeView() {
    store.audio.pause();
    hashHistory.push('/');
  }
  render() {
    let { name, artists, album_images, image_url, album_name } = this.state.track;
    let img = 'http://placehold.it/200x200';
    if (album_images.length) {
      img = album_images[0].url;
    }
    return (
      React.createElement("div", { className: "results-view" },
      React.createElement("div", { className: "track-blur-container" },
      React.createElement("div", { className: "clipped-image-blur" },
      React.createElement(DeferImage, { src: img, placehold: "http://placehold.it/200x200", fade: "2000" }))),


      React.createElement("div", { className: "track-container" },
      React.createElement("div", {
        className: "track-album-cover",
        style: { backgroundImage: `url(${img})` } },
      React.createElement("div", { className: "track-album-overlay" }),
      React.createElement("div", { className: "track-singer-img-container" },
      React.createElement(DeferImage, { src: image_url, placehold: "http://placehold.it/200x200", fade: "1750" }))),


      React.createElement(MusicPlayer, { src: this.state.track.preview_url }),
      React.createElement("div", { className: "track-info" },
      React.createElement("h5", { className: "track-album" }, album_name),
      React.createElement("h3", { className: "track-title" }, name),
      React.createElement("div", { className: "track-singer" },

      artists.map((artist, i) => {
        return (
          React.createElement("div", { key: i },
          React.createElement("p", null, artist.name)));


      })))),




      React.createElement("div", { className: "btn-container" },
      React.createElement("button", { onClick: this.toHomeView, className: "btn" },
      React.createElement("i", { className: "fa fa-repeat" }),
      React.createElement("span", null, "Try again")),

      React.createElement("button", {
        onClick: () => window.open(this.state.track.uri, "_self"),
        className: "btn btn-spotify" },
      React.createElement("i", { className: "fa fa-spotify" }),
      React.createElement("span", null, "Open in Spotify")))));




  }}


let Support = () => {
  return (
    React.createElement("div", { className: "support-view" },
    React.createElement("h1", null, "Oh, this is a bit awkward."),
    React.createElement("p", null, "You'll need Chrome or Opera to use this app."),
    React.createElement("p", null, "Unfortunately, not supported *yet* on iPhone or iPad."),
    React.createElement("button", {
      onClick: () => window.open('https://www.google.com/chrome/'),
      className: "btn" },
    React.createElement("i", { className: "fa fa-chrome" }),
    React.createElement("span", null, "Download Chrome"))));



};

/**
    * @router
    */
ReactDOM.render(
React.createElement(Router, { history: hashHistory },
React.createElement(Route, { path: "/", component: App },
React.createElement(IndexRoute, { component: Home }),
React.createElement(Route, { path: "/result", component: Results })),

React.createElement(Route, { path: "/support", component: Support })),

document.getElementById('app'));