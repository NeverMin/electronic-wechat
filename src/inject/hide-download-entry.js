window.addEventListener('load', () => {
  console.log("load")
  angular.element(document.body)
    .scope()
    .closeDownloadEntry()
})
