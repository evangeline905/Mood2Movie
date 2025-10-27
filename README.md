# 🎬 Mood2Movie

> **Your vibe leads the way to your next favorite movie.**

Mood2Movie is an AI-powered movie recommendation platform that uses Chrome's built-in Prompt API to generate personalized movie suggestions based on your mood, preferences, and viewing history. Simply describe how you're feeling or what kind of movie you want to watch, and our AI will curate the perfect recommendations for you.

## ✨ Features

- 🧠 **AI-Powered Recommendations** - Uses Chrome's LanguageModel API for intelligent movie suggestions
- 🎭 **Mood-Based Matching** - Describe your mood and get movies that match your vibe
- 💾 **Cloud Sync** - Save favorites and watch history with Google account integration
- 🎨 **Beautiful UI** - Movie ticket-inspired design with smooth animations
- 📱 **Responsive Design** - Works perfectly on desktop and mobile devices
- 🔄 **Real-time Generation** - Stream AI responses for instant recommendations
- 🎯 **Smart Filtering** - Avoids recommending movies you've already watched
- 🌍 **Multi-language Support** - Supports English and Chinese interfaces

## 🛠️ Tech Stack

### Frontend
- **HTML5** - Semantic markup with modern browser features
- **CSS3** - Advanced styling with gradients, animations, and Grid layouts
- **Vanilla JavaScript (ES6+)** - No framework dependencies, pure performance
- **Chrome Prompt API** - Browser-native AI model integration
- **Web APIs** - localStorage, Fetch API, AbortController

### Backend
- **Node.js + Express** - Lightweight server architecture
- **http-proxy-middleware** - Reverse proxy to Supabase

### Database & Authentication
- **Supabase** - Backend-as-a-Service with PostgreSQL
- **Google OAuth** - Secure third-party authentication

### External APIs
- **TMDB (The Movie Database)** - Movie data and poster images
- **OMDb API** - Backup movie data source

## 🚀 Getting Started

### Prerequisites

- **Chrome 138+** with experimental features enabled
- **Node.js 16+** for local development
- **Google Account** for authentication (optional)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/Mood2Movie.git
   cd Mood2Movie
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Enable Chrome Experimental Features**
   - Open Chrome and navigate to `chrome://flags/`
   - Search for "Prompt API" and enable it
   - Restart Chrome

4. **Start the development server**
   ```bash
   npm start
   ```

5. **Open your browser**
   - Navigate to `http://localhost:8000`
   - The app should load and be ready to use!

## 🎯 Usage

### Basic Movie Recommendation

1. **Describe Your Mood**
   - Enter how you're feeling or what type of movie you want
   - Examples: "I want a heartwarming comedy" or "Something dark and mysterious"

2. **Generate Recommendations**
   - Click the "Generate" button
   - Wait for AI to process your request (first time may take longer due to model download)

3. **Explore Results**
   - Browse through 3 personalized movie recommendations
   - Each recommendation includes poster, rating, and detailed reasoning

### Account Features

1. **Sign In with Google**
   - Click "Account" in the top navigation
   - Sign in with your Google account for cloud sync

2. **Manage Your Movies**
   - Mark movies as "Favourite" or "Watched"
   - Access your collection in "My Movies" page
   - Data syncs across devices when signed in


## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# TMDB API (Optional)
TMDB_API_KEY=your_tmdb_api_key
TMDB_READ_TOKEN=your_tmdb_read_token

# OMDb API (Optional)
OMDB_API_KEY=your_omdb_api_key
```

### Chrome Flags

Enable these Chrome flags for optimal experience:

```
chrome://flags/#prompt-api-multimodal-input
chrome://flags/#enable-experimental-web-platform-features
```

## 📱 API Reference

### Chrome Prompt API

The app uses Chrome's built-in LanguageModel API:

```javascript
// Check API availability
const availability = await LanguageModel.availability();

// Create a session
const session = await LanguageModel.create({
  signal: controller.signal,
  language: 'en',
  initialPrompts: [{
    role: 'system',
    content: 'Your system prompt here...'
  }]
});

// Generate recommendations
const stream = session.promptStreaming('Generate movie recommendations');
```

### Supabase Integration

```javascript
// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Save movie to favorites
const { data, error } = await supabase
  .from('user_movie_marks')
  .upsert({ user_id: uid, movie_id: movieId, mark: 'favorite' });
```

## 🎨 Customization

### Styling

The app uses CSS custom properties for easy theming:

```css
:root {
  --bg-start: #fff6ee;
  --bg-end: #ffe9f3;
  --text: #442b2b;
  --accent-1: #ff8ba7;
  --accent-2: #ffb38a;
  --accent-3: #ffd88e;
}
```

### Adding New Features

1. **New Recommendation Sources**
   - Add new API endpoints in `script.js`
   - Update the `getPosterUrl()` function

2. **Custom AI Prompts**
   - Modify the system prompt in `startRecommendation()`
   - Adjust the JSON schema for different output formats

## 🐛 Troubleshooting

### Common Issues

**Chrome Prompt API not available**
- Ensure Chrome 138+ is installed
- Check that experimental flags are enabled
- Verify sufficient disk space (model download requires ~2GB)

**Authentication issues**
- Clear browser cache and cookies
- Check Supabase configuration
- Verify Google OAuth settings

**Movie recommendations not loading**
- Check internet connection
- Verify TMDB API keys
- Check browser console for errors

### Debug Mode

Enable debug logging:

```javascript
// In browser console
window.M2M_DEBUG.log('CUSTOM_EVENT', { data: 'your data' });
window.M2M_DEBUG.download(); // Download debug logs
```

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Commit your changes**
   ```bash
   git commit -m 'Add some amazing feature'
   ```
4. **Push to the branch**
   ```bash
   git push origin feature/amazing-feature
   ```
5. **Open a Pull Request**

### Development Guidelines

- Follow existing code style and conventions
- Add comments for complex logic
- Test on multiple browsers and devices
- Update documentation for new features

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **The Movie Database (TMDB)** for movie data and images
- **OMDb API** for additional movie information
- **Supabase** for backend infrastructure
- **Google Fonts** for typography
- **Chrome Team** for the Prompt API

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/evangeline905/Mood2Movie/issues)
- **Discussions**: [GitHub Discussions](https://github.com/evangeline905/Mood2Movie/discussions)
- **Email**: aerialzephyr2025@gmail.com

## 🔮 Roadmap

- [ ] **Multi-language AI responses** - Support for Chinese, Spanish, French
- [ ] **Advanced filtering** - Genre, year, rating filters
- [ ] **Social features** - Share recommendations with friends
- [ ] **Mobile app** - Native iOS and Android apps
- [ ] **Voice input** - Speech-to-text for mood descriptions
- [ ] **Recommendation history** - Track and analyze your preferences

---

<div align="center">

**Made with ❤️ for movie lovers everywhere**

[⭐ Star this repo](https://github.com/evangeline905/Mood2Movie) | [🐛 Report Bug](https://github.com/evangeline905/Mood2Movie/issues) | [💡 Request Feature](https://github.com/evangeline905/Mood2Movie/issues)

</div>
