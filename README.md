# Windows端口转发管理系统

这是一个基于Node.js+Express的Windows端口转发管理系统，提供了Web界面来管理端口转发规则和查看连接日志。

## 做这个程序的想法：

我的公司网络需要软件验证才可以进入公司内网，然后我又想在Ubuntu部署一些局域网通讯及其他程序，验证软件又没有Ubuntu版的，且无法通过wine进行安装（它的原理就像剪映一样，下载一个下载程序，判断当前计算机是否满足条件才可以进行下载）

### 实现：

​	一台能访问局域网的Windows电脑（有两个网口），一台用来运行服务的电脑，能上局域网的电脑作为中转服务器即可

## 功能特点

- 创建、编辑、启用/禁用和删除端口转发规则
- 自动记录所有连接和数据传输
- 直观的Web界面查看连接日志和IP地址
- 配置保存在文件系统和config.yml文件中
- 支持用户登录认证
- 按日期自动归档日志数据

## 安装步骤

1. 安装Node.js (https://nodejs.org/)
2. 克隆或下载本仓库
3. 在命令行中进入项目目录，运行 `npm install` 安装依赖![four](.\image\four.png)

## 配置文件

配置文件 `config.yml` 包含以下内容：

```yaml
# 服务器配置
server:
  port: 3000

# 管理员账号配置
admin:
  username: admin
  password: admin

# 端口转发配置
forwards:
  - name: 默认转发
    sourcePort: 8080
    targetHost: 192.168.1.100
    targetPort: 8080
    enabled: true
```

## 使用方法

1. 启动应用：
   ```
   npm start
   ```
   或者开发模式：
   ```
   npm run dev
   ```

2. 打开浏览器访问 `http://localhost:3000`

3. 使用配置文件中设置的账号密码登录：
   - 默认用户名：admin
   - 默认密码：admin
   - 可在`config.yml`文件中的`admin`部分修改

4. 使用Web界面添加转发规则：
   - 点击"添加新规则"按钮
   - 填写规则名称、源端口（本机监听的端口）和目标地址（转发的目标主机和端口）
   - 选择是否立即启用
   - 点击"保存"按钮

5. 查看连接日志：
   - 点击导航栏的"连接日志"链接
   - 查看所有连接的详细信息，包括时间、IP地址和数据传输量

## 数据存储

- 转发规则保存在 `/logs/forwards.json` 文件中
- 连接日志按日期保存在 `/logs/YYYY_MM_DD/log.json` 文件中，实现自动归档
- 配置信息同时保存在 `config.yml` 文件中

## 注意事项

- 请确保源端口未被其他应用占用
- 如需使用1024以下的端口，可能需要管理员权限
- 确保防火墙允许相应端口的访问
- 应用运行在局域网环境中，所有资源已本地化，无需外网访问

# 截图

![two](.\image\two.png)

![three](.\image\three.png)

![one](.\image\one.png)

# 赞赏（随心即可）：

<div style="overflow: auto;">
  <img src="./image/five.jpg" alt="left" style="float: left; width: 33%; margin-right: 10px;">
  <img src="./image/six.jpg" alt="right" style="width: 65%; left; width: 33%;">
</div>

## 许可证

ISC 