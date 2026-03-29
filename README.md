# Research Studio

一个偏苹果风格的个人科研工作台，支持：

- 上传文献并保存阅读笔记
- 记录科研想法并手动编辑
- 上传仿真结果并保存说明
- 上传实验结果并保存说明
- 所有数据保存在浏览器本地 `IndexedDB`

## 本地使用

直接打开 `index.html` 即可。

更推荐用本地静态服务访问，这样文件链接和浏览器存储更稳定。任选一种：

1. VS Code 安装 Live Server 后打开项目目录并启动
2. Python 可用时，在目录内运行 `python -m http.server 8080`

然后打开：

- `http://localhost:8080`

## 部署到网上

这是纯静态网站，可以部署到：

- GitHub Pages
- Netlify
- Vercel
- Cloudflare Pages

### GitHub Pages

1. 新建一个 GitHub 仓库
2. 上传这 4 个文件：
   - `index.html`
   - `styles.css`
   - `app.js`
   - `README.md`
3. 进入仓库 `Settings > Pages`
4. 在 `Build and deployment` 中选择：
   - `Source: Deploy from a branch`
   - `Branch: main / root`
5. 保存后等待几分钟
6. 访问生成的网址，通常形如：
   - `https://你的用户名.github.io/仓库名/`

### Netlify

1. 注册并登录 Netlify
2. 新建一个站点
3. 直接把整个项目文件夹拖进 Netlify
4. 部署完成后获得公开网址

## 当前版本的保存方式

当前版本的数据保存在访问该网页的浏览器本地数据库中。

这意味着：

- 刷新页面后数据仍会保留
- 同一台电脑、同一个浏览器下可持续使用
- 如果清除浏览器站点数据，内容会丢失
- 换电脑或换浏览器不会自动同步

## 如果你想要真正云端同步

下一步可以把它升级成“在线数据库版本”，常见方案：

- Supabase
- Firebase
- Appwrite

这样你就可以：

- 在不同设备上查看同一份科研记录
- 通过账号登录管理数据
- 真正把上传的文献和实验文件保存到云端
