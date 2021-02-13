tsParticles.load("tsparticles", {
  fpsLimit: 60,
  detectRetina: true,
  particles: {
    move: {
      enable: true
    },
    number: {
      value: 100
    },
    size: {
      random: {
        enable: true,
        minimumValue: 10
      },
      value: 30
    },
    shape: {
      options: {
        images: [{
          src: 'https://api.iconify.design/twemoji:burrito.svg',
          width: 100,
          height: 100
        },
        {
          src: 'https://api.iconify.design/twemoji:taco.svg',
          width: 100,
          height: 100
        }
        ]
      },
      type: "image"
    }
  }
});
