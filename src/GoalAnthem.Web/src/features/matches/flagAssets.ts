import arFlag from 'flag-icons/flags/4x3/ar.svg?url';
import atFlag from 'flag-icons/flags/4x3/at.svg?url';
import auFlag from 'flag-icons/flags/4x3/au.svg?url';
import baFlag from 'flag-icons/flags/4x3/ba.svg?url';
import beFlag from 'flag-icons/flags/4x3/be.svg?url';
import brFlag from 'flag-icons/flags/4x3/br.svg?url';
import caFlag from 'flag-icons/flags/4x3/ca.svg?url';
import cdFlag from 'flag-icons/flags/4x3/cd.svg?url';
import chFlag from 'flag-icons/flags/4x3/ch.svg?url';
import ciFlag from 'flag-icons/flags/4x3/ci.svg?url';
import coFlag from 'flag-icons/flags/4x3/co.svg?url';
import cwFlag from 'flag-icons/flags/4x3/cw.svg?url';
import czFlag from 'flag-icons/flags/4x3/cz.svg?url';
import deFlag from 'flag-icons/flags/4x3/de.svg?url';
import dzFlag from 'flag-icons/flags/4x3/dz.svg?url';
import ecFlag from 'flag-icons/flags/4x3/ec.svg?url';
import egFlag from 'flag-icons/flags/4x3/eg.svg?url';
import esFlag from 'flag-icons/flags/4x3/es.svg?url';
import frFlag from 'flag-icons/flags/4x3/fr.svg?url';
import gbFlag from 'flag-icons/flags/4x3/gb.svg?url';
import ghFlag from 'flag-icons/flags/4x3/gh.svg?url';
import hrFlag from 'flag-icons/flags/4x3/hr.svg?url';
import htFlag from 'flag-icons/flags/4x3/ht.svg?url';
import iqFlag from 'flag-icons/flags/4x3/iq.svg?url';
import irFlag from 'flag-icons/flags/4x3/ir.svg?url';
import joFlag from 'flag-icons/flags/4x3/jo.svg?url';
import jpFlag from 'flag-icons/flags/4x3/jp.svg?url';
import krFlag from 'flag-icons/flags/4x3/kr.svg?url';
import maFlag from 'flag-icons/flags/4x3/ma.svg?url';
import mxFlag from 'flag-icons/flags/4x3/mx.svg?url';
import nlFlag from 'flag-icons/flags/4x3/nl.svg?url';
import noFlag from 'flag-icons/flags/4x3/no.svg?url';
import nzFlag from 'flag-icons/flags/4x3/nz.svg?url';
import paFlag from 'flag-icons/flags/4x3/pa.svg?url';
import ptFlag from 'flag-icons/flags/4x3/pt.svg?url';
import pyFlag from 'flag-icons/flags/4x3/py.svg?url';
import qaFlag from 'flag-icons/flags/4x3/qa.svg?url';
import saFlag from 'flag-icons/flags/4x3/sa.svg?url';
import seFlag from 'flag-icons/flags/4x3/se.svg?url';
import snFlag from 'flag-icons/flags/4x3/sn.svg?url';
import tnFlag from 'flag-icons/flags/4x3/tn.svg?url';
import trFlag from 'flag-icons/flags/4x3/tr.svg?url';
import usFlag from 'flag-icons/flags/4x3/us.svg?url';
import uyFlag from 'flag-icons/flags/4x3/uy.svg?url';
import uzFlag from 'flag-icons/flags/4x3/uz.svg?url';
import zaFlag from 'flag-icons/flags/4x3/za.svg?url';

export const flagAssets = {
  AR: arFlag,
  AT: atFlag,
  AU: auFlag,
  BA: baFlag,
  BE: beFlag,
  BR: brFlag,
  CA: caFlag,
  CD: cdFlag,
  CH: chFlag,
  CI: ciFlag,
  CO: coFlag,
  CW: cwFlag,
  CZ: czFlag,
  DE: deFlag,
  DZ: dzFlag,
  EC: ecFlag,
  EG: egFlag,
  ES: esFlag,
  FR: frFlag,
  GB: gbFlag,
  GH: ghFlag,
  HR: hrFlag,
  HT: htFlag,
  IQ: iqFlag,
  IR: irFlag,
  JO: joFlag,
  JP: jpFlag,
  KR: krFlag,
  MA: maFlag,
  MX: mxFlag,
  NL: nlFlag,
  NO: noFlag,
  NZ: nzFlag,
  PA: paFlag,
  PT: ptFlag,
  PY: pyFlag,
  QA: qaFlag,
  SA: saFlag,
  SE: seFlag,
  SN: snFlag,
  TN: tnFlag,
  TR: trFlag,
  US: usFlag,
  UY: uyFlag,
  UZ: uzFlag,
  ZA: zaFlag,
} as const;

export type SupportedCountryCode = keyof typeof flagAssets;
