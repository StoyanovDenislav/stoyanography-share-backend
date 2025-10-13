const express = require("express");
const AuthService = require("../services/authService");
const {
  authenticateToken,
  clearTokenCookie,
  clearSessionIdCookie,
} = require("../middleware/auth");

const router = express.Router();
const authService = new AuthService();

// Register route
router.post("/register", AuthService.getRegisterValidation(), (req, res) =>
  authService.register(req, res)
);

// Login route
router.post("/login", AuthService.getLoginValidation(), (req, res) =>
  authService.login(req, res)
);

// Get user profile (protected route)
router.get("/profile", authenticateToken, (req, res) =>
  authService.getProfile(req, res)
);

// Change password (protected route)
router.post("/change-password", authenticateToken, (req, res) =>
  authService.changePassword(req, res)
);

// Refresh token route
router.post("/refresh", (req, res) => authService.refreshToken(req, res));

// Logout route (clears HTTP-only cookies and revokes session)
router.post("/logout", authenticateToken, async (req, res) => {
  await authService.logout(req, res);
  clearTokenCookie(res);
  clearSessionIdCookie(res);
  res.json({
    success: true,
    message: "Logout successful",
  });
});

// Verify token route
router.get("/verify", authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: "Token is valid",
    user: {
      userId: req.user.userId,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role,
      // Include additional fields from token if they exist
      ...(req.user.businessName && { businessName: req.user.businessName }),
      ...(req.user.clientName && { clientName: req.user.clientName }),
      ...(req.user.guestName && { guestName: req.user.guestName }),
      ...(req.user.photographerId && {
        photographerId: req.user.photographerId,
      }),
      ...(req.user.clientId && { clientId: req.user.clientId }),
      ...(req.user.expiresAt && { expiresAt: req.user.expiresAt }),
    },
  });
});

module.exports = router;
