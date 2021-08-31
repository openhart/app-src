import React from "react";
import "./App.css";
import {AutoSizer, CellMeasurer, CellMeasurerCache, List} from "react-virtualized";
import {
  HashRouter as Router,
  Switch,
  Route,
  Link,
  useParams,
  Redirect,
} from "react-router-dom";
import logo from "./logo.svg";

const _ = require("lodash");
const emoji = require("node-emoji");
const cache = new CellMeasurerCache({
  defaultHeight: 100,
  fixedWidth: true
});

function emojify(s) {
  return emoji.emojify(s, (name) => {
    switch (name) {
      case "face_with_symbols_over_mouth":
        return emoji.get(":face_with_symbols_on_mouth:");
      case "rofl":
        return emoji.get(":rolling_on_the_floor_laughing:");
      default:
        return name;
    }
  });
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

class Message extends React.Component {
  render() {
    var text = this.props.text;
    var chunks = [];
    if (this.props.type !== undefined) {
      switch (this.props.type) {
        case "au":
          chunks.push(<span className="t">user <em>{text}</em> added by <em>{this.props.user.username}</em></span>);
          break;
        case "discussion-created":
          chunks.push(<span className="t">created a discussion: <em>{text}</em></span>);
          break;
        case "message_pinned":
          chunks.push(<span className="t">pinned a message: <em>{text}</em></span>);
          break;
        case "r":
          chunks.push(<span className="t">room name changed to <em>{text}</em> by <em>{this.props.user.username}</em></span>);
          break;
        case "rm":
          chunks.push(<span className="t">message removed</span>);
          break;
        case "room_changed_announcement":
          chunks.push(<span className="t">room announcement changed to <em>{text || "(none)"}</em> by <em>{this.props.user.username}</em></span>);
          break;
        case "room_changed_description":
          chunks.push(<span className="t">room description changed to <em>{text || "(none)"}</em> by <em>{this.props.user.username}</em></span>);
          break;
        case "room_changed_privacy":
          chunks.push(<span className="t">room type changed to <em>{text}</em> by <em>{this.props.user.username}</em></span>);
          break;
        case "room_changed_topic":
          chunks.push(<span className="t">room topic changed to <em>{text || "(none)"}</em> by <em>{this.props.user.username}</em></span>);
          break;
        case "ru":
          chunks.push(<span className="t">user <em>{text}</em> removed by <em>{this.props.user.username}</em></span>);
          break;
        case "uj":
          chunks.push(<span className="t">has joined the channel</span>);
          break;
        case "ul":
          chunks.push(<span className="t">has left the channel</span>);
          break;
        case "ut":
          chunks.push(<span className="t">has joined the conversation</span>);
          break;
        default:
          chunks.push(<span className="t">{this.props.type}:<em>{text}</em></span>);
          break;
      }
    } else {
      text = emojify(text);
      if (this.props.filter !== null) {
        let matches = text.matchAll(this.props.filter.regexp);
        let index = 0;
        let id = 0;
        for (var match of matches) {
          if (match.index > index) {
            chunks.push(<span key={this.props.id+"-"+(++id)}>{text.slice(index, match.index)}</span>);
            index = match.index;
          }
          chunks.push(<span key={this.props.id+"-"+(++id)} className="highlight">{match[0]}</span>);
          index += match[0].length;
        }
        if (index < text.length) {
          chunks.push(<span key={this.props.id+"-"+(++id)}>{text.slice(index)}</span>);
        }
      } else {
        chunks = [<span>{text}</span>];
      }
    }
    if (chunks.length === 1) {
      chunks = chunks[0];
    }
    if (this.props.user === undefined) {
      return null;
    }
    let classNames = ["message"];
    if (this.props.type) {
      classNames.push("t");
      classNames.push(this.props.type);
    }
    if (this.props.active) {
      classNames.push("active");
    }
    var reactions = [];
    if (this.props.reactions !== undefined) {
      for (let k in this.props.reactions) {
        reactions.push({reaction: k, reactors: this.props.reactions[k]});
      }
    }
    return (
      <div className={classNames.join(" ")} id={this.props.id}>
        <div className="avatar"><img src={"/app/avatars/"+this.props.user.avatar} alt={this.props.user.name} /></div>
        <div className="data">
          <div className="meta">
            <div className="name">{this.props.user.name}</div>
            <div className="username">{this.props.user.username}</div>
            <div className="ts">{(new Date(this.props.ts)).toISOString()}</div>
            <div className="channel"><Link to={"/channel/"+this.props.channel.id+"/"+this.props.id}>#{this.props.channel.name}</Link></div>
            <div className="link"><Link to={"/channel/"+this.props.channel.id+"/"+this.props.id}>{emoji.get(":link:")}</Link></div>
          </div>
          <div className="text">
            {chunks}
          </div>
          <AttachmentList attachments={this.props.attachments} messageId={this.props.id} />
          <div className="reactions">
            {reactions.map((reaction) => (
              <Reaction key={reaction.reaction} data-tip={reaction.reactors} data-event="click focus" {...reaction} />
            ))}
          </div>
        </div>
      </div>
    );
  }
}

class AttachmentList extends React.Component {
  render() {
    if (this.props.attachments === undefined) {
      return null;
    }
    return (
      <div className="attachments">
        {this.props.attachments.map((attachment, index) => (
          <div key={"attachment"+this.props.messageId+"-"+index} className="attachment">
            <div className="name">
              <span>{attachment.name}</span>
            </div>
          </div>
        ))}
      </div>
    )
  }
}

class Reaction extends React.Component {
  render() {
    return (
      <div className="reaction">
        <div className="emoji" title={this.props.reaction}>{emojify(this.props.reaction)}</div>
        <div className="users">
          {this.props.reactors.map(username => (
            <span key={username} className="user">@{username}</span>
          ))}
        </div>
      </div>
    );
  }
}

class MessageList extends React.Component {
  constructor(props) {
    super(props);
    this.rowRenderer = this.rowRenderer.bind(this);
    this.list = React.createRef();
  }
  rowRenderer({ index, isScrolling, key, parent, style }) {
    return (
      <CellMeasurer
        cache={cache}
        columnIndex={0}
        key={key}
        parent={parent}
        rowIndex={index}
      >
        {({ measure, registerChild }) => (
          <div ref={registerChild} style={style}>
            <Message active={this.props.messages[index].id===this.props.messageId} filter={this.props.filter} {...this.props.messages[index]} />
          </div>
        )}
      </CellMeasurer>
    );
  }
  render() {
    cache.clearAll();
    var index = 0;
    if (this.props.messageId !== undefined) {
      for (let i = 0; i < this.props.messages.length; i++) {
        if (this.props.messages[i].id === this.props.messageId) {
          index = i;
          break;
        }
      }
    }
    return (
      <div className="list">
        <AutoSizer onResize={({width, height}) => {
          cache.clearAll();
          this.list.current.forceUpdateGrid();
          this.list.current.recomputeRowHeights();
        }}>
          {({ height, width }) => (
            <List
              width={width}
              height={height}
              rowCount={this.props.messages.length}
              rowHeight={cache.rowHeight}
              rowRenderer={this.rowRenderer}
              deferredMeasurementCache={cache}
              scrollToIndex={index}
              ref={this.list}
            />
          )}
        </AutoSizer>
      </div>
    );
  }
}

class Search extends React.Component {
  constructor(props) {
    super(props);
    this.state = { value: null };
    this.ref = React.createRef();
    this.onChange = this.onChange.bind(this);
  }
  onChange() {
    var value = this.ref.current.value;
    if (value !== this.state.value) {
      this.setState({
        value: value
      });
      if (this.props.onChange !== undefined) {
        this.props.onChange(value);
      }
    }
  }
  render() {
    return (
      <div className="search">
        <input ref={this.ref} type="search" placeholder="search" onChange={this.onChange} />
      </div>
    );
  }
}

class ChannelList extends React.Component {
  render() {
    var channels = [{id: 'all', name: 'all', ts: 0}].concat(this.props.channels);
    return (
      <div className="channels">
        {channels.map(channel => {
          let classNames = ["channel"];
          if (this.props.channelId === channel.id) {
            classNames.push("active");
          }
          if (channel.ts > 1627775999000) {
            classNames.push("updated");
          }
          classNames = classNames.join(" ");
          return (
            <Link to={"/channel/"+channel.id} key={channel.id} className={classNames} title={channel.name || channel.id}>{channel.name || channel.id}</Link>
          );
        })}
      </div>
    );
  }
}

class Chat extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      data: null,
      filter: null,
    };
    this.onFilterChanged = _.debounce(this.onFilterChanged.bind(this), 500);
    this.filteredMessages = this.filteredMessages.bind(this);
  }
  componentDidMount() {
    fetch("/app/data.json")
      .then(res => res.json())
      .then((data) => {
        function un(s) {
          return s.split("").map(x => un.lookup[x] || x).join("");
        }
        un.i = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split("");
        un.o = "HO326I4pkDUaj9KGF05VEbtu1qvWeyAJRZsXBLofSdwlxC8hzrc7PnYMNQgiTm".split("");
        un.lookup = un.i.reduce((m,k,i) => Object.assign(m, {[k]: un.o[i]}), {});
        var channels = {}, users = {};
        data.channels.forEach(channel => {
          channel.name = un(channel.name);
          channels[channel.id] = channel;
        });
        data.users.forEach(user => {
          user.name = un(user.name);
          user.username = un(user.username);
          users[user.id] = user;
        });
        data.messages.forEach(message => {
          message.text = un(message.text)
          if (message.attachments !== undefined) {
            message.attachments.forEach(attachment => {
              attachment.name = un(attachment.name);
            });
          }
          if (message.reactions !== undefined) {
            for (let k in message.reactions) {
              message.reactions[k] = message.reactions[k].map(un);
            }
          }
          if (channels[message.channel.id] !== undefined) {
            message.channel = channels[message.channel.id];
          } else {
            data.channels.push(channels[message.channel.id]={id: message.channel.id, name: message.channel.id});
          }
          message.user = users[message.user.id];
        });
        this.setState({ data: data });
      });
  }
  onFilterChanged(filter) {
    if (filter) {
      filter = {
        string: filter
      };
      filter.string = filter.string.replace(/\s*\b(\w+):(\S*)/g, ((match, k, v) => {
        switch (k) {
          case "after":
            v = Date.parse(v);
            if (!isNaN(v)) filter.after = v;
            break;
          case "before":
            v = Date.parse(v);
            if (!isNaN(v)) filter.before = v;
            break;
          case "user":
            try {
              filter.user = new RegExp(v, "i");
            } catch(e) {
              filter.user = new RegExp(escapeRegExp(v), "i");
            }
            break;
          default:
            return match;
        }
        return "";
      }));
      try {
        filter["regexp"] = new RegExp(filter.string, "gi");
      } catch(error) {
        filter["regexp"] = new RegExp(escapeRegExp(filter.string), "gi");
      }
    } else {
      filter = null;
    }
    this.setState({
      filter: filter
    })
  }
  filteredMessages() {
    setTimeout(() => {
      cache.clearAll();
    }, 0)
    return this.state.data.messages.filter(message => {
      if (this.props.channelId !== "all" && message.channel.id !== this.props.channelId) {
        return false;
      }
      if (this.state.filter !== null) {
        return ((filter, message) => {
          if (filter.after !== undefined && message.ts < filter.after) {
            return false;
          }
          if (filter.before !== undefined && message.ts >= filter.before) {
            return false;
          }
          if (filter.user !== undefined) {
            if (!filter.user.test(message.user.username) && !filter.user.test(message.user.name)) {
              return false;
            }
          }
          return (
            filter.regexp.test(message.text) ||
            filter.regexp.test(message.user.name) ||
            filter.regexp.test(message.user.username) ||
            filter.regexp.test("@"+message.user.username) ||
            (filter.regexp.source.length >= 17 && filter.regexp.test(message.id))
          );
        })(this.state.filter, message);
      }
      return true;
    });
  }
  render() {
    if (this.state.data === null) {
      return (
        <div className="loading">
          <img src={logo} alt="logo" />
        </div>
      );
    }
    return (
      <div className="chat">
        <ChannelList channels={this.state.data.channels} channelId={this.props.channelId} />
        <div className="messages" id={"messages-"+this.props.channelId}>
          <MessageList filter={this.state.filter} messages={this.filteredMessages()} messageId={this.props.messageId} />
          <Search onChange={this.onFilterChanged} />
        </div>
      </div>
    );
  }
}

function Channel() {
  let { channel, message } = useParams();

  return (
    <Chat channelId={channel} messageId={message} />
  );
}

function App() {
  return (
    <div className="App">
      <Router>
        <Switch>
          <Route path="/channel/:channel/:message" children={<Channel />} />
          <Route path="/channel/:channel" children={<Channel />} />
          <Route exact path="/">
            <Redirect to="/channel/all" />
          </Route>
        </Switch>
      </Router>
    </div>
  );
}

export default App;
