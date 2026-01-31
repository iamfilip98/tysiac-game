# Page snapshot

```yaml
- generic [ref=e1]:
  - main [ref=e3]:
    - generic [ref=e4]:
      - heading "Tysiąc" [level=1] [ref=e5]
      - paragraph [ref=e6]: Polish Card Game • 1000
      - generic [ref=e9]: Connected
    - generic [ref=e10]:
      - button "Create Room" [active] [ref=e11] [cursor=pointer]
      - button "Join Room" [ref=e12] [cursor=pointer]
    - generic [ref=e15]:
      - heading "Create New Room" [level=2] [ref=e16]
      - generic [ref=e17]:
        - generic [ref=e18]:
          - generic [ref=e19]: Your Name
          - textbox "Your Name" [ref=e20]:
            - /placeholder: Enter your name
            - text: TestPlayer
        - generic [ref=e21]:
          - generic [ref=e22]: Room Name
          - textbox "Room Name" [ref=e23]:
            - /placeholder: Enter room name
            - text: TestRoom
        - generic [ref=e24]:
          - button [ref=e25] [cursor=pointer]
          - generic [ref=e27]: Private room
      - button "Create Room" [ref=e28] [cursor=pointer]
    - generic [ref=e29]:
      - heading "Quick Rules" [level=3] [ref=e30]
      - list [ref=e31]:
        - listitem [ref=e32]: • 3 players, 24-card deck (9-A in each suit)
        - listitem [ref=e33]: • Bid for the right to pick up the talon
        - listitem [ref=e34]: • Declare marriages (K+Q) for bonus points
        - listitem [ref=e35]: • First to 1000 points wins!
  - region "Notifications"
  - alert [ref=e36]
```