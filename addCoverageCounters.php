<?php

class AddCoverageCounters{
  public $out;
  private $idx, $len, $line, $marker, $js, $markerPrefix;
  public function __construct($js, $markerPrefix){
    $this->markerPrefix = $markerPrefix;
    $this->js = $js;
    $this->idx = 0;
    $this->len = strlen($js);
    $this->line = 1;
    $this->marker = 0;
    $this->out = '';
    $this->markers = [];
    while($this->idx < $this->len){
      $token = $this->getToken();

      switch ($token) {
        case '"':
        case "'":
          $this->stringState($token);
          break;
        case '/':
          $this->slashState(); // line comment, block comment or regex
          break;
        case 'function':
        case 'if':
        case 'for':
        case 'while':
          $this->functionalBlockState();
          break;
      }
    }

    if (count($this->markers) > 0){
      $markers = implode("',\n  '", $this->markers);
      $this->out .= "\n\nLapiz.Test.regMks(\n  '$markers'\n);\n";
    }
  }

  private function addMarker(){
    $marker = $this->markerPrefix . ') ' . $this->line . ' : ' . $this->marker;
    $this->out .= 'Lapiz.Test.incMk("' . $marker . '");';
    $this->markers[] = $marker;
  }

  private function getToken(){
    $token = $this->getChr();
    $ascii = ord($token);
    if ( ($ascii > 64 && $ascii < 91) || ($ascii > 96 && $ascii < 123) ){
      while($this->idx < $this->len){
        $chr = substr($this->js, $this->idx, 1);
        $ascii = ord($chr);
        if ( ($ascii > 64 && $ascii < 91) || ($ascii > 96 && $ascii < 123) ){
          $this->out .= $chr;
          $token .= $chr;
          $this->idx+=1;
        } else {
          break;
        }
      }
    }
    return strtolower($token);
  }

  private function getChr(){
    $chr = substr($this->js, $this->idx, 1);
    $this->out .= $chr;
    $this->idx += 1;
    if ($chr == "\n"){
      $this->line += 1;
      $this->marker = 0;
    }
    return $chr;
  }

  // string state is also used to check regex
  // this will fail for /[/]/, but should probably use /[\/]/ any way
  private function stringState($quoteType){
    $skip = false;
    while($this->idx < $this->len){
      $chr = $this->getChr();
      if ($skip){
        $skip = false;
        continue;
      }
      switch ($chr) {
        case "\\":
          $skip = true;
          break;
        case $quoteType:
          return;
      }
    }
  }

  private function slashState(){
    $chr = $this->getChr();
    switch ($chr) {
      case '/':
        $this->lineCommentState();
        break;
      case '*':
        $this->blockCommentState();
        break;
      default:
        $this->stringState('/');
        break;
    }
  }

  private function lineCommentState(){
    while($this->idx < $this->len){
      $chr = $this->getChr();
      if ($chr == "\n") { return; }
    }
  }

  private function blockCommentState(){
    $endOnSlash = false;
    while($this->idx < $this->len){
      $chr = $this->getChr();

      if ($chr == '/' && $endOnSlash){
        return;
      } else {
        $endOnSlash = ($chr == '*');
      }
    }
  }

  private function functionalBlockState(){
    $parenDepth = 0;
    while($this->idx < $this->len){
      $chr = $this->getChr();
      switch ($chr) {
        case '(':
          $parenDepth += 1;
          break;
        case ')':
          $parenDepth -= 1;
          break;
        case '{':
          if ($parenDepth == 0){
            $this->addMarker();
            return;
          }
          break;
        case ' ':
        case "\n":
        case "\t":
          break;
        default:
          if ($parenDepth == 0){
            return;
          }
      }
    }
  }
}
?>