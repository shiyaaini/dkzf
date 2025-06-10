const express = require('express');
const bodyParser = require('body-parser');
const net = require('net');
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');
const moment = require('moment');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');

// 初始化Express应用
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('layout extractScripts', true);
app.use(express.static(path.join(__dirname, 'public')));

// 使用session
app.use(session({
  secret: 'port-forwarding-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24小时
}));

// 读取配置文件
let config;
try {
  config = yaml.load(fs.readFileSync('config.yml', 'utf8'));
} catch (e) {
  console.error('配置文件读取错误:', e);
  process.exit(1);
}

// 确保日志目录存在
const logsDir = path.join(__dirname, 'logs');
try {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
} catch (err) {
  console.error('创建日志目录错误:', err);
  process.exit(1);
}

// 获取当前日期格式化为YYYY_MM_DD
function getCurrentDateString() {
  return moment().format('YYYY_MM_DD');
}

// 获取特定日期的日志文件路径
function getLogFilePathForDate(dateString) {
  const dateDirPath = path.join(logsDir, dateString);
  // 确保日期目录存在
  if (!fs.existsSync(dateDirPath)) {
    fs.mkdirSync(dateDirPath, { recursive: true });
  }
  return path.join(dateDirPath, 'log.json');
}

// 获取当前日期的日志文件路径
function getCurrentLogFilePath() {
  return getLogFilePathForDate(getCurrentDateString());
}

// 获取转发规则文件路径
const forwardsFilePath = path.join(logsDir, 'forwards.json');

// 初始化转发规则文件
if (!fs.existsSync(forwardsFilePath)) {
  try {
    fs.writeFileSync(forwardsFilePath, JSON.stringify({ forwards: [] }, null, 2));
  } catch (err) {
    console.error('创建转发规则文件错误:', err);
    process.exit(1);
  }
}

// 读取转发规则
function readForwards() {
  try {
    if (!fs.existsSync(forwardsFilePath)) {
      return { forwards: [] };
    }
    return JSON.parse(fs.readFileSync(forwardsFilePath, 'utf8'));
  } catch (err) {
    console.error('读取转发规则文件错误:', err);
    return { forwards: [] };
  }
}

// 保存转发规则
function saveForwards(data) {
  try {
    fs.writeFileSync(forwardsFilePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('保存转发规则文件错误:', err);
  }
}

// 读取特定日期的日志
function readLogForDate(dateString) {
  const logFilePath = getLogFilePathForDate(dateString);
  try {
    if (!fs.existsSync(logFilePath)) {
      return { logs: [] };
    }
    return JSON.parse(fs.readFileSync(logFilePath, 'utf8'));
  } catch (err) {
    console.error(`读取日期 ${dateString} 的日志文件错误:`, err);
    return { logs: [] };
  }
}

// 保存日志到特定日期
function saveLogForDate(dateString, logData) {
  const logFilePath = getLogFilePathForDate(dateString);
  try {
    fs.writeFileSync(logFilePath, JSON.stringify(logData, null, 2));
  } catch (err) {
    console.error(`保存日期 ${dateString} 的日志文件错误:`, err);
  }
}

// 添加日志记录
function addLogEntry(logEntry) {
  const dateString = moment(logEntry.timestamp).format('YYYY_MM_DD');
  const logData = readLogForDate(dateString);
  
  // 分配ID
  logEntry.id = logData.logs.length > 0 ? Math.max(...logData.logs.map(log => log.id)) + 1 : 1;
  
  // 添加日志
  logData.logs.push(logEntry);
  
  // 保存
  saveLogForDate(dateString, logData);
  
  return logEntry;
}

// 更新日志记录
function updateLogEntry(logEntry) {
  const dateString = moment(logEntry.timestamp).format('YYYY_MM_DD');
  const logData = readLogForDate(dateString);
  
  // 查找并更新日志
  const index = logData.logs.findIndex(log => log.id === logEntry.id);
  if (index !== -1) {
    logData.logs[index] = logEntry;
    saveLogForDate(dateString, logData);
    return true;
  }
  
  return false;
}

// 获取所有日志记录
function getAllLogs(limit = 100) {
  const allLogs = [];
  
  // 获取日志目录下的所有子目录（按日期）
  try {
    const dateDirs = fs.readdirSync(logsDir)
      .filter(item => {
        const dirPath = path.join(logsDir, item);
        return fs.statSync(dirPath).isDirectory() && /^\d{4}_\d{2}_\d{2}$/.test(item);
      })
      .sort()
      .reverse(); // 最新的日期优先
    
    // 从每个日期目录读取日志
    for (const dateDir of dateDirs) {
      const logFilePath = path.join(logsDir, dateDir, 'log.json');
      
      if (fs.existsSync(logFilePath)) {
        try {
          const data = JSON.parse(fs.readFileSync(logFilePath, 'utf8'));
          if (data.logs && Array.isArray(data.logs)) {
            allLogs.push(...data.logs);
            
            // 如果已经读取足够多的日志，就停止
            if (allLogs.length >= limit) {
              break;
            }
          }
        } catch (err) {
          console.error(`读取日志文件 ${logFilePath} 错误:`, err);
        }
      }
    }
    
    // 限制返回数量并按时间倒序排序
    return allLogs
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
      
  } catch (err) {
    console.error('读取日志目录错误:', err);
    return [];
  }
}

// 保存配置到config.yml
function saveConfig() {
  try {
    fs.writeFileSync('config.yml', yaml.dump(config), 'utf8');
    console.log('配置已保存到config.yml');
  } catch (err) {
    console.error('保存配置错误:', err);
  }
}

// 同步配置文件中的转发规则到数据文件
function syncForwardsToDataFile() {
  try {
    if (!config.forwards || !Array.isArray(config.forwards)) {
      return;
    }
    
    const data = readForwards();
    const existingMap = new Map();
    data.forwards.forEach(fw => {
      existingMap.set(fw.source_port, fw);
    });
    
    let nextId = 1;
    if (data.forwards.length > 0) {
      nextId = Math.max(...data.forwards.map(f => f.id)) + 1;
    }
    
    for (const forward of config.forwards) {
      if (!existingMap.has(forward.sourcePort)) {
        data.forwards.push({
          id: nextId++,
          name: forward.name,
          source_port: forward.sourcePort,
          target_host: forward.targetHost,
          target_port: forward.targetPort,
          enabled: forward.enabled,
          created_at: new Date().toISOString()
        });
      }
    }
    
    saveForwards(data);
  } catch (err) {
    console.error('同步转发规则到数据文件错误:', err);
  }
}

// 活跃的转发服务器
const forwardServers = new Map();

// 创建转发服务器
function createForwardServer(forward) {
  if (forwardServers.has(forward.source_port)) {
    const existingServer = forwardServers.get(forward.source_port);
    existingServer.close();
    forwardServers.delete(forward.source_port);
  }

  const server = net.createServer(async (clientSocket) => {
    const clientIp = clientSocket.remoteAddress.replace(/^::ffff:/, '');
    console.log(`新连接: ${clientIp} -> ${forward.source_port}`);
    
    // 记录连接日志
    try {
      const logEntry = {
        forward_id: forward.id,
        client_ip: clientIp,
        timestamp: new Date().toISOString(),
        bytes_transferred: 0
      };
      
      addLogEntry(logEntry);
    } catch (err) {
      console.error('记录连接日志错误:', err);
    }

    // 创建到目标的连接
    const targetSocket = net.createConnection({
      host: forward.target_host,
      port: forward.target_port
    }, () => {
      console.log(`已连接到目标: ${forward.target_host}:${forward.target_port}`);
    });

    // 双向数据传输
    let bytesTransferred = 0;
    clientSocket.on('data', (data) => {
      bytesTransferred += data.length;
      targetSocket.write(data);
    });

    targetSocket.on('data', (data) => {
      bytesTransferred += data.length;
      clientSocket.write(data);
    });

    // 错误处理
    clientSocket.on('error', (err) => {
      console.error('客户端连接错误:', err);
      targetSocket.destroy();
    });

    targetSocket.on('error', (err) => {
      console.error('目标连接错误:', err);
      clientSocket.destroy();
    });

    // 连接关闭
    clientSocket.on('close', async () => {
      console.log(`客户端连接关闭: ${clientIp}`);
      targetSocket.destroy();
      
      // 更新传输的字节数
      try {
        const currentDate = moment().format('YYYY_MM_DD');
        const logData = readLogForDate(currentDate);
        
        // 找到最近的这个客户端IP的连接记录
        const logEntries = logData.logs.filter(
          log => log.forward_id === forward.id && log.client_ip === clientIp
        ).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        if (logEntries.length > 0) {
          const logEntry = logEntries[0];
          logEntry.bytes_transferred += bytesTransferred;
          updateLogEntry(logEntry);
        }
      } catch (err) {
        console.error('更新连接日志错误:', err);
      }
    });

    targetSocket.on('close', () => {
      console.log(`目标连接关闭: ${forward.target_host}:${forward.target_port}`);
      clientSocket.destroy();
    });
  });

  server.listen(forward.source_port, () => {
    console.log(`端口转发服务器运行在端口 ${forward.source_port} -> ${forward.target_host}:${forward.target_port}`);
  });

  server.on('error', (err) => {
    console.error(`端口 ${forward.source_port} 监听错误:`, err);
    forwardServers.delete(forward.source_port);
  });

  forwardServers.set(forward.source_port, server);
}

// 初始化所有转发服务器
function initForwardServers() {
  try {
    const data = readForwards();
    const enabledForwards = data.forwards.filter(forward => forward.enabled);
    
    enabledForwards.forEach(forward => {
      createForwardServer(forward);
    });
  } catch (err) {
    console.error('初始化转发服务器错误:', err);
  }
}

// 认证中间件
function requireLogin(req, res, next) {
  if (req.session && req.session.loggedIn) {
    return next();
  } else {
    return res.redirect('/login');
  }
}

// 登录路由
app.get('/login', (req, res) => {
  res.render('login', { layout: false, error: null });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  // 使用配置文件中的管理员账号验证
  const adminUsername = config.admin?.username || 'admin';
  const adminPassword = config.admin?.password || 'admin';
  
  // 简单的身份验证
  if (username === adminUsername && password === adminPassword) {
    req.session.loggedIn = true;
    req.session.username = username;
    return res.redirect('/');
  } else {
    return res.render('login', { layout: false, error: '用户名或密码错误' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// 所有其他路由需要登录
app.use(requireLogin);

// 路由设置
app.get('/', async (req, res) => {
  try {
    const data = readForwards();
    res.render('index', { forwards: data.forwards });
  } catch (err) {
    console.error('获取转发列表错误:', err);
    res.status(500).send('服务器错误');
  }
});

app.get('/logs', async (req, res) => {
  try {
    // 获取过去几天的所有日志
    const allLogs = getAllLogs(100);
    const data = readForwards();
    
    const logs = allLogs.map(log => {
      const forward = data.forwards.find(f => f.id === log.forward_id) || {};
      
      return {
        ...log,
        name: forward.name || '未知规则',
        source_port: forward.source_port || 0,
        target_host: forward.target_host || '未知主机',
        target_port: forward.target_port || 0,
        formattedTime: moment(log.timestamp).format('YYYY-MM-DD HH:mm:ss'),
        formattedBytes: (log.bytes_transferred / 1024).toFixed(2) + ' KB'
      };
    });
    
    res.render('logs', { logs });
  } catch (err) {
    console.error('获取日志错误:', err);
    res.status(500).send('服务器错误');
  }
});

app.get('/add-forward', (req, res) => {
  res.render('add-forward');
});

app.post('/add-forward', async (req, res) => {
  try {
    const { name, sourcePort, targetHost, targetPort, enabled } = req.body;
    const isEnabled = enabled === 'on' || enabled === true;
    
    const data = readForwards();
    const newId = data.forwards.length > 0 ? Math.max(...data.forwards.map(f => f.id)) + 1 : 1;
    
    const newForward = {
      id: newId,
      name,
      source_port: parseInt(sourcePort),
      target_host: targetHost,
      target_port: parseInt(targetPort),
      enabled: isEnabled,
      created_at: new Date().toISOString()
    };
    
    data.forwards.push(newForward);
    saveForwards(data);
    
    // 如果启用，创建转发服务器
    if (isEnabled) {
      createForwardServer(newForward);
    }
    
    // 更新配置文件
    if (!config.forwards) {
      config.forwards = [];
    }
    
    config.forwards.push({
      name,
      sourcePort: parseInt(sourcePort),
      targetHost: targetHost,
      targetPort: parseInt(targetPort),
      enabled: isEnabled
    });
    
    saveConfig();
    
    res.redirect('/');
  } catch (err) {
    console.error('添加转发规则错误:', err);
    res.status(500).send('服务器错误');
  }
});

app.get('/edit-forward/:id', async (req, res) => {
  try {
    const data = readForwards();
    const forward = data.forwards.find(f => f.id === parseInt(req.params.id));
    
    if (!forward) {
      return res.status(404).send('转发规则不存在');
    }
    
    res.render('edit-forward', { forward });
  } catch (err) {
    console.error('获取转发规则错误:', err);
    res.status(500).send('服务器错误');
  }
});

app.post('/edit-forward/:id', async (req, res) => {
  try {
    const { name, sourcePort, targetHost, targetPort, enabled } = req.body;
    const isEnabled = enabled === 'on' || enabled === true;
    const id = parseInt(req.params.id);
    
    const data = readForwards();
    const forwardIndex = data.forwards.findIndex(f => f.id === id);
    
    if (forwardIndex === -1) {
      return res.status(404).send('转发规则不存在');
    }
    
    // 保存旧的source_port用于检查是否更改
    const oldSourcePort = data.forwards[forwardIndex].source_port;
    
    // 更新转发规则
    data.forwards[forwardIndex] = {
      ...data.forwards[forwardIndex],
      name,
      source_port: parseInt(sourcePort),
      target_host: targetHost,
      target_port: parseInt(targetPort),
      enabled: isEnabled
    };
    
    saveForwards(data);
    
    // 关闭旧服务器（如果源端口更改）
    if (forwardServers.has(oldSourcePort)) {
      const server = forwardServers.get(oldSourcePort);
      server.close();
      forwardServers.delete(oldSourcePort);
    }
    
    // 如果启用，创建新服务器
    if (isEnabled) {
      createForwardServer(data.forwards[forwardIndex]);
    }
    
    // 更新配置文件
    if (config.forwards && Array.isArray(config.forwards)) {
      const configIndex = config.forwards.findIndex(f => f.sourcePort === oldSourcePort);
      
      if (configIndex !== -1) {
        config.forwards[configIndex] = {
          name,
          sourcePort: parseInt(sourcePort),
          targetHost: targetHost,
          targetPort: parseInt(targetPort),
          enabled: isEnabled
        };
      } else {
        config.forwards.push({
          name,
          sourcePort: parseInt(sourcePort),
          targetHost: targetHost,
          targetPort: parseInt(targetPort),
          enabled: isEnabled
        });
      }
      
      saveConfig();
    }
    
    res.redirect('/');
  } catch (err) {
    console.error('更新转发规则错误:', err);
    res.status(500).send('服务器错误');
  }
});

app.post('/toggle-forward/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = readForwards();
    const forwardIndex = data.forwards.findIndex(f => f.id === id);
    
    if (forwardIndex === -1) {
      return res.status(404).json({ success: false, message: '转发规则不存在' });
    }
    
    const forward = data.forwards[forwardIndex];
    const newStatus = !forward.enabled;
    
    // 更新状态
    data.forwards[forwardIndex].enabled = newStatus;
    saveForwards(data);
    
    if (newStatus) {
      // 启用服务器
      createForwardServer(data.forwards[forwardIndex]);
    } else {
      // 禁用服务器
      if (forwardServers.has(forward.source_port)) {
        const server = forwardServers.get(forward.source_port);
        server.close();
        forwardServers.delete(forward.source_port);
      }
    }
    
    // 更新配置文件
    if (config.forwards && Array.isArray(config.forwards)) {
      const configIndex = config.forwards.findIndex(f => f.sourcePort === forward.source_port);
      
      if (configIndex !== -1) {
        config.forwards[configIndex].enabled = newStatus;
        saveConfig();
      }
    }
    
    res.json({ success: true, enabled: newStatus });
  } catch (err) {
    console.error('切换转发状态错误:', err);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

app.post('/delete-forward/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = readForwards();
    const forwardIndex = data.forwards.findIndex(f => f.id === id);
    
    if (forwardIndex === -1) {
      return res.status(404).json({ success: false, message: '转发规则不存在' });
    }
    
    const forward = data.forwards[forwardIndex];
    
    // 关闭服务器
    if (forwardServers.has(forward.source_port)) {
      const server = forwardServers.get(forward.source_port);
      server.close();
      forwardServers.delete(forward.source_port);
    }
    
    // 从数据中删除规则
    data.forwards.splice(forwardIndex, 1);
    saveForwards(data);
    
    // 更新配置文件
    if (config.forwards && Array.isArray(config.forwards)) {
      const configIndex = config.forwards.findIndex(f => f.sourcePort === forward.source_port);
      
      if (configIndex !== -1) {
        config.forwards.splice(configIndex, 1);
        saveConfig();
      }
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('删除转发规则错误:', err);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 启动应用
function startApp() {
  // 同步配置
  syncForwardsToDataFile();
  // 初始化转发服务器
  initForwardServers();
  
  app.listen(config.server.port, () => {
    console.log(`Web服务器运行在 http://localhost:${config.server.port}`);
  });
}

startApp(); 